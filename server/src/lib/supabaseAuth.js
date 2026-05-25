const { createClient } = require('@supabase/supabase-js')
const { logger } = require('./logger')

const getSupabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const getSupabaseAnonKey = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let authClient = null
let adminClient = null
let missingConfigWarned = false

const createServerClient = (key) =>
  createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'thinava-server',
      },
    },
  })

const isSupabaseAuthConfigured = () => Boolean(getSupabaseUrl() && getSupabaseAnonKey())

const getSupabaseAuthClient = () => {
  if (!isSupabaseAuthConfigured()) {
    if (!missingConfigWarned) {
      missingConfigWarned = true
      logger.warn('Supabase Auth is not configured; restaurant auth is using legacy bcrypt fallback', {
        tag: 'supabase_auth',
        hasUrl: Boolean(getSupabaseUrl()),
        hasAnonKey: Boolean(getSupabaseAnonKey()),
      })
    }
    return null
  }

  if (!authClient) {
    authClient = createServerClient(getSupabaseAnonKey())
  }

  return authClient
}

const getSupabaseAdminClient = () => {
  if (!getSupabaseUrl() || !getSupabaseServiceRoleKey()) {
    return null
  }

  if (!adminClient) {
    adminClient = createServerClient(getSupabaseServiceRoleKey())
  }

  return adminClient
}

const getSupabaseAuthStatus = () => ({
  configured: isSupabaseAuthConfigured(),
  hasServiceRole: Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey()),
})

const logSupabaseAuthResponse = (flow, email, data, error, extra = {}) => {
  const payload = {
    tag: 'supabase_auth',
    flow,
    email,
    success: !error,
    userId: data?.user?.id || null,
    userEmail: data?.user?.email || null,
    hasSession: Boolean(data?.session),
    emailConfirmed: Boolean(data?.user?.email_confirmed_at),
    errorMessage: error?.message || null,
    errorStatus: error?.status || null,
    errorCode: error?.code || error?.name || null,
    ...extra,
  }

  if (error) {
    logger.warn(`Supabase Auth ${flow} failed`, payload)
  } else {
    logger.info(`Supabase Auth ${flow} succeeded`, payload)
  }
}

const getCleanSupabaseAuthMessage = (error, fallback = 'Authentication failed') => {
  const message = String(error?.message || fallback)

  if (/email not confirmed/i.test(message)) {
    return 'Please verify your email before signing in. For testing, temporarily disable Confirm email in Supabase Auth settings.'
  }

  if (/invalid login credentials|invalid.*credentials/i.test(message)) {
    return 'Invalid email or password'
  }

  if (/already registered|already exists|user already/i.test(message)) {
    return 'Email already registered'
  }

  return message
}

const getSupabaseAuthHttpStatus = (error, fallback = 401) => {
  const message = String(error?.message || '')
  if (/already registered|already exists|user already/i.test(message)) {
    return 409
  }
  if (/email not confirmed/i.test(message)) {
    return 403
  }
  return error?.status || fallback
}

module.exports = {
  getCleanSupabaseAuthMessage,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabaseAuthHttpStatus,
  getSupabaseAuthStatus,
  isSupabaseAuthConfigured,
  logSupabaseAuthResponse,
}
