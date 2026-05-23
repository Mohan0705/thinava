'use client'

// This file is kept for backward compatibility but should not be used
// Use direct process.env.NEXT_PUBLIC_* access in api.ts instead

// Debug: Show what values are available at runtime
if (typeof window !== 'undefined') {
  console.log('[ENV_DEBUG] Frontend env vars:')
  console.log('[ENV_DEBUG] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || 'undefined')
  console.log('[ENV_DEBUG] NEXT_PUBLIC_SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL || 'undefined')
  console.log('[ENV_DEBUG] NODE_ENV:', process.env.NODE_ENV || 'undefined')
}

export const env = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || '',
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
}

