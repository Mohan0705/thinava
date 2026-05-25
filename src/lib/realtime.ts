import { io, Socket } from 'socket.io-client'
import { apiConfig } from '@/config/api'
import { useEffect, useRef } from 'react'
import { clearStoredAuthForScope, isValidJwt } from '@/lib/auth/session'
import type { AuthScope } from '@/lib/auth/cookies'

export type RealtimeRole = 'admin' | 'customer' | 'delivery_partner' | 'restaurant'

type SubscribeResponse = {
  success: boolean
  error?: string
  code?: string
  rooms?: string[]
}

const getSocketBaseUrl = () => apiConfig.socketUrl

const sockets = new Map<string, { socket: Socket; refCount: number }>()

const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 2000
const ROLE_SCOPE: Record<RealtimeRole, AuthScope> = {
  admin: 'admin',
  customer: 'customer',
  delivery_partner: 'delivery',
  restaurant: 'restaurant',
}

export const getRealtimeSocket = (role: RealtimeRole, token: string) => {
  if (!isValidJwt(token)) {
    clearStoredAuthForScope(ROLE_SCOPE[role])
    console.warn('[SOCKET] Skipping realtime connection because token is invalid', {
      role,
      hasToken: Boolean(token),
      tokenParts: typeof token === 'string' ? token.split('.').length : 0,
    })
    return null
  }

  const key = `${role}:${token}`

  const existing = sockets.get(key)
  if (existing) {
    existing.refCount++
    console.log(`[SOCKET] Reusing existing socket for ${role}`)
    return existing.socket
  }

  const socket = io(getSocketBaseUrl(), {
    transports: ['websocket'],
    reconnectionAttempts: RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })

  socket.on('connect', () => {
    console.log('[SOCKET] Connected', { socketId: socket.id, role })
    socket.emit('session:subscribe', { role, token }, (response: SubscribeResponse) => {
      if (!response?.success) {
        console.error('[SOCKET] Subscription failed:', response?.error || 'Unknown error')
        if (response?.code === 'INVALID_REALTIME_TOKEN' || response?.code === 'REALTIME_AUTH_REQUIRED') {
          clearStoredAuthForScope(ROLE_SCOPE[role])
        }
        socket.disconnect()
      } else {
        console.log('[SOCKET] Subscription successful', {
          socketId: socket.id,
          role,
          rooms: response?.rooms || 'unknown',
        })
      }
    })
  })

  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] Disconnected', { socketId: socket.id, role, reason })
  })

  socket.on('connect_error', (error) => {
    console.error('[SOCKET] Connection error', { message: error.message, role })
  })

  socket.on('session:error', (response: SubscribeResponse & { code?: string }) => {
    console.error('[SOCKET] Session error', {
      message: response?.error || 'Realtime authentication failed',
      code: response?.code,
      role,
    })

    if (response?.code === 'INVALID_REALTIME_TOKEN' || response?.code === 'REALTIME_AUTH_REQUIRED') {
      clearStoredAuthForScope(ROLE_SCOPE[role])
    }
    socket.disconnect()
  })

  // Listen to all events for debugging
  socket.onAny((event, ...args) => {
    if (event !== 'heartbeat' && event !== 'session:subscribed') {
      console.log('[SOCKET] Received event', { event, role, socketId: socket.id })
    }
  })

  sockets.set(key, { socket, refCount: 1 })
  return socket
}

export const releaseRealtimeSocket = (role: RealtimeRole, token: string) => {
  if (!isValidJwt(token)) return

  const key = `${role}:${token}`
  const existing = sockets.get(key)
  if (!existing) return

  existing.refCount--
  if (existing.refCount <= 0) {
    existing.socket.removeAllListeners()
    existing.socket.disconnect()
    sockets.delete(key)
  }
}

export const disconnectRealtimeSocket = () => {
  for (const [key, { socket }] of sockets) {
    socket.removeAllListeners()
    socket.disconnect()
  }
  sockets.clear()
}

export function useRealtimeSocket(role: RealtimeRole, token: string | null) {
  const roleRef = useRef(role)
  const tokenRef = useRef(token)
  roleRef.current = role
  tokenRef.current = token

  useEffect(() => {
    if (!token || !isValidJwt(token)) return
    const socket = getRealtimeSocket(role, token)
    if (!socket) return
    return () => {
      releaseRealtimeSocket(role, token)
    }
  }, [role, token])
}
