import { env } from './env'

const SOCKET_BASE_URL = env.NEXT_PUBLIC_SOCKET_URL
  ? env.NEXT_PUBLIC_SOCKET_URL
  : env.NEXT_PUBLIC_API_URL
    ? env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000'

export const apiConfig = {
  baseUrl: env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  socketUrl: SOCKET_BASE_URL,
  timeout: 15000,
  retryCount: 2,
}
