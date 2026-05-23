const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key] as string | undefined
  }
  return undefined
}

export const env = {
  NEXT_PUBLIC_API_URL: getEnvVar('NEXT_PUBLIC_API_URL'),
  NEXT_PUBLIC_SOCKET_URL: getEnvVar('NEXT_PUBLIC_SOCKET_URL'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: getEnvVar('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY') || '',
  NODE_ENV: getEnvVar('NODE_ENV') || 'development',
}

export function validateFrontendEnv(): void {
  if (typeof window === 'undefined') {
    const required = ['NEXT_PUBLIC_API_URL'] as const
    const missing = required.filter((key) => !env[key])
    if (missing.length > 0) {
      console.warn(`[env] Missing frontend env vars: ${missing.join(', ')}. Using fallback defaults.`)
    }
  }
}
