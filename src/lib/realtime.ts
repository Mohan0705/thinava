import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '@/lib/api'
import { useEffect, useRef } from 'react'

export type RealtimeRole = 'admin' | 'customer' | 'delivery_partner' | 'restaurant'

type SubscribeResponse = {
  success: boolean
  error?: string
}

const getSocketBaseUrl = () => {
  const explicitUrl = process.env.NEXT_PUBLIC_SOCKET_URL
  if (explicitUrl) {
    return explicitUrl
  }
  return API_BASE_URL.replace(/\/api\/?$/, '')
}

const sockets = new Map<string, { socket: Socket; refCount: number }>()

const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 2000

export const getRealtimeSocket = (role: RealtimeRole, token: string) => {
  const key = `${role}:${token}`

  const existing = sockets.get(key)
  if (existing) {
    existing.refCount++
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
    socket.emit('session:subscribe', { role, token }, (response: SubscribeResponse) => {
      if (!response?.success) {
        console.error(response?.error || 'Realtime subscription failed')
      }
    })
  })

  sockets.set(key, { socket, refCount: 1 })
  return socket
}

export const releaseRealtimeSocket = (role: RealtimeRole, token: string) => {
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
    if (!token) return
    const socket = getRealtimeSocket(role, token)
    return () => {
      releaseRealtimeSocket(role, token)
    }
  }, [role, token])
}
