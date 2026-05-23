const jwt = require('jsonwebtoken')
const { getCustomerJwtSecret } = require('../modules/auth/middleware/auth')
const { getAdminJwtSecret } = require('../modules/admin/middleware/auth')
const { getRestaurantJwtSecret } = require('../modules/restaurantPanel/middleware/auth')

const DELIVERY_JWT_SECRET = process.env.DELIVERY_JWT_SECRET || 'delivery-secret-key'
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

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

const authenticateRealtimeSession = ({ role, token }) => {
  if (!role || !token) {
    const error = new Error('Realtime role and token are required')
    error.status = 401
    throw error
  }

  switch (role) {
    case ROLES.DELIVERY_PARTNER: {
      const decoded = jwt.verify(token, DELIVERY_JWT_SECRET)
      return {
        role,
        subjectId: decoded.id,
        rooms: [ROOMS.deliveryPartner(decoded.id), ROOMS.DELIVERY_FLEET],
      }
    }
    case ROLES.CUSTOMER: {
      const decoded = jwt.verify(token, getCustomerJwtSecret())
      return {
        role,
        subjectId: decoded.userId,
        rooms: [ROOMS.customer(decoded.userId)],
      }
    }
    case ROLES.ADMIN: {
      const decoded = jwt.verify(token, getAdminJwtSecret())
      return {
        role,
        subjectId: decoded.adminUserId,
        rooms: [ROOMS.admin(decoded.adminUserId), ROOMS.ADMIN_GLOBAL],
      }
    }
    case ROLES.RESTAURANT: {
      const decoded = jwt.verify(token, getRestaurantJwtSecret())
      return {
        role,
        subjectId: decoded.restaurantUserId,
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
const MAX_CONNECTIONS = 200
const eventRateMap = new Map()

const createSocketServer = (httpServer, options = {}) => {
  const { Server } = require('socket.io')

  const io = new Server(httpServer, {
    cors: {
      origin: options.origin || DEFAULT_FRONTEND_URL,
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket'],
    allowEIO3: false,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  })

  const isRateLimited = (socketId) => {
    const now = Date.now()
    const lastEvent = eventRateMap.get(socketId) || 0
    if (now - lastEvent < 100) {
      return true
    }
    eventRateMap.set(socketId, now)
    return false
  }

  io.on('connection', (socket) => {
    connectionCount++
    console.log(`[REALTIME] Socket connected (${connectionCount} total)`)

    socket.on('disconnect', (reason) => {
      connectionCount--
      eventRateMap.delete(socket.id)
      console.log(`[REALTIME] Socket disconnected: ${reason} (${connectionCount} total)`)
    })

    if (connectionCount > MAX_CONNECTIONS) {
      console.warn(`[REALTIME] Connection limit exceeded, rejecting socket ${socket.id}`)
      socket.emit('server:error', { message: 'Server connection limit reached. Please try again later.' })
      socket.disconnect(true)
      return
    }

    socket.on('session:subscribe', (payload = {}, callback = () => undefined) => {
      if (isRateLimited(socket.id)) return

      try {
        const session = authenticateRealtimeSession(payload)
        session.rooms.forEach((room) => socket.join(room))
        socket.data.session = session

        callback({
          success: true,
          role: session.role,
          subject_id: session.subjectId,
          rooms: session.rooms,
        })
      } catch (error) {
        callback({
          success: false,
          error: error.message || 'Realtime authentication failed',
          status: error.status || 401,
        })
      }
    })

    socket.on('session:unsubscribe', (_payload = {}, callback = () => undefined) => {
      if (isRateLimited(socket.id)) return

      const joinedRooms = socket.data?.session?.rooms || []
      joinedRooms.forEach((room) => socket.leave(room))
      socket.data.session = null
      callback({ success: true })
    })

    socket.on('order:join', ({ orderId }, callback = () => undefined) => {
      if (isRateLimited(socket.id)) return

      socket.join(`order:${orderId}`)
      callback({ success: true, room: `order:${orderId}` })
    })

    socket.on('order:leave', ({ orderId }, callback = () => undefined) => {
      if (isRateLimited(socket.id)) return

      socket.leave(`order:${orderId}`)
      callback({ success: true, room: `order:${orderId}` })
    })
  })

  socketServer = io
  return io
}

const getSocketServer = () => socketServer
const getIoInstance = () => socketServer

const emitToRoom = (room, event, payload) => {
  if (!socketServer || !room || !event) {
    return
  }

  socketServer.to(room).emit(event, payload)
}

setInterval(() => {
  const now = Date.now()
  for (const [socketId, lastEvent] of eventRateMap) {
    if (now - lastEvent > 60000) {
      eventRateMap.delete(socketId)
    }
  }
}, 60000)

module.exports = {
  ROLES,
  ROOMS,
  createSocketServer,
  emitToRoom,
  getSocketServer,
  getIoInstance,
}
