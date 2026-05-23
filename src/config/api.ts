import { env } from './env'

// In production, NEXT_PUBLIC_API_URL must be set
const API_URL = env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const SOCKET_URL = env.NEXT_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, '')

export const apiConfig = {
  baseUrl: API_URL,
  socketUrl: SOCKET_URL,
  timeout: 15000,
  retryCount: 2,
}
