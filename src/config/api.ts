'use client'

// Direct Next.js environment variable access
// NEXT_PUBLIC_* vars are automatically injected by Next.js at build time
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL || ''

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[API_CONFIG] NEXT_PUBLIC_API_URL:', API_BASE_URL || '(NOT SET)')
  console.log('[API_CONFIG] NEXT_PUBLIC_SOCKET_URL:', SOCKET_BASE_URL || '(NOT SET)')
  console.log('[API_CONFIG] NODE_ENV:', process.env.NODE_ENV)
  
  if (!API_BASE_URL) {
    console.error('[API_CONFIG] ❌ CRITICAL: NEXT_PUBLIC_API_URL environment variable is not set!')
    console.error('[API_CONFIG] In Vercel, add: NEXT_PUBLIC_API_URL=https://thinava.onrender.com/api')
  } else {
    console.log('[API_CONFIG] ✓ API configuration loaded successfully')
  }
}

// Derive socket URL from API URL if not explicitly set
const SOCKET_URL = SOCKET_BASE_URL || (API_BASE_URL ? API_BASE_URL.replace(/\/api\/?$/, '') : '')

export const apiConfig = {
  baseUrl: API_BASE_URL,
  socketUrl: SOCKET_URL,
  timeout: 15000,
  retryCount: 2,
}
