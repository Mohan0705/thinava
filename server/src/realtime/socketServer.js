const { verifyCustomerToken, verifyAdminToken, verifyRiderToken, verifyRestaurantToken } = require('../lib/auth/tokenService')
const env = require('../config/env')
const { logger } = require('../lib/logger')

const DEFAULT_FRONTEND_URL = env.FRONTEND_URL

const ROLES = {
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  DELIVERY_PARTNER: 'delivery_partner',
  RESTAURANT: 'restaurant',
}

const ROOMS = {
  ADMIN_GLOBAL: 'admin:global',
  DELIVERY_FLEET: 'delivery:fleet',
  admin: (adminUserId) => `admin:${adminUserId}`,
  customer: (userId) => `customer:${userId}`,
  deliveryPartner: (partnerId) => `delivery_partner:${partnerId}`,
  restaurant: (restaurantId) => `restaurant:${restaurantId}`,
}

let socketServer = null
let heartbeatInterval = null

const MAX_LISTENERS_PER_SOCKET = 20
const MAX_CONNECTIONS = 200
const HEARTBEAT_INTERVAL_MS = 25000
const STALE_SOCKET_TIMEOUT_MS = 60000

const isValidJwt = (token) => {
  if (!token || typeof token !== 'string') {
    return false
  }

  const parts = token.trim().split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

const authenticateRealtimeSession = ({ role, token }) => {
  if (!role) {
    const error = new Error('Realtime role and token are required')
    error.status = 401
    error.code = 'REALTIME_AUTH_REQUIRED'
    throw error
  }

  if (!isValidJwt(token)) {
    const error = new Error('Realtime session token is invalid')
    error.status = 401
    error.code = 'INVALID_REALTIME_TOKEN'
    throw error
  }

  switch (role) {
    case ROLES.DELIVERY_PARTNER: {
      const decoded = verifyRiderToken(token)
      return {
        role,
        subjectId: decoded.sub,
        rooms: [ROOMS.deliveryPartner(decoded.sub), ROOMS.DELIVERY_FLEET],
      }
    }
    case ROLES.CUSTOMER: {
      const decoded = verifyCustomerToken(token)
      return {
        role,
        subjectId: decoded.sub,
        rooms: [ROOMS.customer(decoded.sub)],
      }
    }
    case ROLES.ADMIN: {
      const decoded = verifyAdminToken(token)
      return {
        role,
        subjectId: decoded.sub,
        rooms: [ROOMS.admin(decoded.sub), ROOMS.ADMIN_GLOBAL],
      }
    }
    case ROLES.RESTAURANT: {
      const decoded = verifyRestaurantToken(token)
      return {
        role,
        subjectId: decoded.sub,
        rooms: [ROOMS.restaurant(decoded.restaurantId)],
      }
    }
    default: {
      const error = new Error('Unsupported realtime role')
      error.status = 400
      throw error
    }
  }
}

let connectionCount = 0
const eventRateMap = new Map()

const startHeartbeat = (io) => {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  heartbeatInterval = setInterval(() => {
    const now = Date.now()
    const sockets = io.sockets.sockets
    if (!sockets) return

    for (const [id, socket] of sockets) {
      try {
        const lastPing = socket.data._lastPing || 0
        if (now - lastPing > STALE_SOCKET_TIMEOUT_MS) {
          logger.warn('Stale socket disconnected', { socketId: id, tag: 'realtime' })
          socket.disconnect(true)
          continue
        }
        socket.emit('heartbeat', { timestamp: new Date().toISOString() })
      } catch (err) {
        logger.error('Heartbeat error', { error: err, socketId: id, tag: 'realtime' })
      }
    }

    // Clean stale eventRateMap entries
    if (eventRateMap.size > 10000) {
      const cutoff = now - 60000
      for (const [key, time] of eventRateMap) {
        if (time < cutoff) eventRateMap.delete(key)
      }
    }
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatInterval.unref()
}

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

const createSocketServer = (httpServer, options = {}) => {
  const { Server } = require('socket.io')
  const io = new Server(httpServer, {
    cors: {
      origin: options.corsOrigin || DEFAULT_FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
    pingTimeout: 30000,
    pingInterval: 10000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  })

  io.use((socket, next) => {
    if (connectionCount >= (options.maxConnections || MAX_CONNECTIONS)) {
      return next(new Error('Server at maximum connection capacity'))
    }
    socket.setMaxListeners(MAX_LISTENERS_PER_SOCKET)
    socket.data._lastPing = Date.now()
    next()
  })

  io.on('connection', (socket) => {
    connectionCount += 1

    socket.on('heartbeat', () => {
      socket.data._lastPing = Date.now()
    })

    socket.on('session:subscribe', (payload, acknowledgement) => {
      try {
        const session = authenticateRealtimeSession(payload)
        socket.data.session = session
        session.rooms.forEach((room) => socket.join(room))
        
        // STEP 2: Log room subscription
        console.log('[SOCKET_SUBSCRIBE]', {
          socketId: socket.id,
          role: session.role,
          riderId: session.subjectId,
          rooms: session.rooms,
          connectedAt: new Date().toISOString(),
        })
        
        // Verify rooms in adapter
        if (session.role === ROLES.DELIVERY_PARTNER) {
          const riderRoom = `delivery_partner:${session.subjectId}`
          const socketsInRoom = io.sockets.adapter.rooms.get(riderRoom)
          console.log('[ROOM_VERIFY]', {
            riderId: session.subjectId,
            riderRoom,
            socketsInRoom: socketsInRoom ? socketsInRoom.size : 0,
            thisSocketId: socket.id,
          })
        }
        
        const response = { success: true, rooms: session.rooms }
        if (typeof acknowledgement === 'function') {
          acknowledgement(response)
        }
        socket.emit('session:subscribed', response)
      } catch (error) {
        const response = {
          success: false,
          error: error.message || 'Realtime authentication failed',
          code: error.code || 'REALTIME_AUTH_FAILED',
        }

        console.error('[SOCKET_SUBSCRIBE_ERROR]', {
          socketId: socket.id,
          error: response.error,
          code: response.code,
          role: payload?.role,
          hasToken: Boolean(payload?.token),
          tokenParts: typeof payload?.token === 'string' ? payload.token.split('.').length : 0,
        })

        if (typeof acknowledgement === 'function') {
          acknowledgement(response)
        }
        socket.emit('session:error', response)

        if (error.status === 401) {
          socket.disconnect(true)
        }
      }
    })

    socket.on('event:emit', (payload, acknowledgement) => {
      if (!socket.data.session) {
        if (acknowledgement) acknowledgement({ error: 'Not authenticated' })
        return
      }

      const { event, data, target } = payload

      if (!event || !data || !target) {
        if (acknowledgement) acknowledgement({ error: 'Event, data, and target are required' })
        return
      }

      const rateKey = `${socket.id}:${event}`
      const now = Date.now()
      const lastEmit = eventRateMap.get(rateKey) || 0

      if (now - lastEmit < 100) {
        if (acknowledgement) acknowledgement({ error: 'Rate limited' })
        return
      }

      eventRateMap.set(rateKey, now)

      const room = ROOMS[target.type]?.(target.id)
      if (!room) {
        if (acknowledgement) acknowledgement({ error: `Unknown target type: ${target.type}` })
        return
      }

      io.to(room).emit(event, {
        ...data,
        _meta: { source: socket.id, timestamp: new Date().toISOString() },
      })

      if (acknowledgement) acknowledgement({ success: true })
    })

    socket.on('disconnect', () => {
      connectionCount -= 1
      eventRateMap.delete(socket.id)
    })
  })

  startHeartbeat(io)
  socketServer = io
  return io
}

const closeSocketServer = async () => {
  stopHeartbeat()
  if (socketServer) {
    await socketServer.close()
    socketServer = null
    connectionCount = 0
    eventRateMap.clear()
  }
}

const getIO = () => socketServer
const getIoInstance = getIO

const emitToRoom = (room, event, data) => {
  const io = socketServer
  if (!io) {
    return false
  }
  
  // Log delivery_partner events for debugging
  if (room.startsWith('delivery_partner:') && event.startsWith('delivery:')) {
    console.log('[REALTIME_EMIT]', {
      room,
      event,
      dataKeys: Object.keys(data || {}),
    })
  }
  
  io.to(room).emit(event, {
    ...data,
    _meta: {
      timestamp: new Date().toISOString(),
    },
  })
  return true
}

module.exports = {
  createSocketServer,
  closeSocketServer,
  getIO,
  getIoInstance,
  emitToRoom,
  ROLES,
  ROOMS,
  authenticateRealtimeSession,
  isValidJwt,
}
