import { env } from './env'

// PRODUCTION MUST HAVE these env vars set in deployment
const API_URL = env.NEXT_PUBLIC_API_URL
const SOCKET_URL = env.NEXT_PUBLIC_SOCKET_URL || (API_URL ? API_URL.replace(/\/api\/?$/, '') : '')

// Debug logging to verify env vars are loaded correctly
if (typeof window !== 'undefined') {
  console.log('[CONFIG] API_URL:', API_URL)
  console.log('[CONFIG] SOCKET_URL:', SOCKET_URL)
  console.log('[CONFIG] NODE_ENV:', env.NODE_ENV)
}

// Validate critical config
if (!API_URL) {
  console.error('[CONFIG] ERROR: NEXT_PUBLIC_API_URL is not set!')
  console.error('[CONFIG] In production, set NEXT_PUBLIC_API_URL environment variable before deployment')
}

export const apiConfig = {
  baseUrl: API_URL,
  socketUrl: SOCKET_URL,
  timeout: 15000,
  retryCount: 2,
}
