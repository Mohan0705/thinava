import { env } from './env'

// Get environment variables - MUST be set for production
const API_URL = env.NEXT_PUBLIC_API_URL || ''
const SOCKET_URL = env.NEXT_PUBLIC_SOCKET_URL || (API_URL ? API_URL.replace(/\/api\/?$/, '') : '')

// Debug logging to verify env vars are loaded correctly
if (typeof window !== 'undefined') {
  console.log('[CONFIG] Initializing API config...')
  console.log('[CONFIG] API_URL:', API_URL || '(NOT SET)')
  console.log('[CONFIG] SOCKET_URL:', SOCKET_URL || '(NOT SET)')
  console.log('[CONFIG] NODE_ENV:', env.NODE_ENV)
  
  // Critical validation
  if (!API_URL) {
    console.error('[CONFIG] ❌ CRITICAL: NEXT_PUBLIC_API_URL is not set!')
    console.error('[CONFIG] This will cause all API requests to fail.')
    console.error('[CONFIG] In Vercel, add environment variable: NEXT_PUBLIC_API_URL=https://thinava.onrender.com/api')
  } else {
    console.log('[CONFIG] ✓ API configuration loaded successfully')
  }
}

export const apiConfig = {
  baseUrl: API_URL,
  socketUrl: SOCKET_URL,
  timeout: 15000,
  retryCount: 2,
}
