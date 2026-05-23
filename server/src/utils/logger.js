/**
 * Thinava logging system
 * Provides structured logging with tags for debugging
 */

const LOG_TAGS = {
  API: '[API]',
  DB: '[DB]',
  AUTH: '[AUTH]',
  REALTIME: '[REALTIME]',
  FETCH: '[FETCH]',
  ERROR: '[ERROR]',
  WARN: '[WARN]',
  INFO: '[INFO]',
  DEBUG: '[DEBUG]',
}

const isDev = () => process.env.NODE_ENV !== 'production'

const logger = {
  api: (message, data) => {
    console.log(`${LOG_TAGS.API} ${message}`, data || '')
  },
  db: (message, data) => {
    console.log(`${LOG_TAGS.DB} ${message}`, data || '')
  },
  auth: (message, data) => {
    console.log(`${LOG_TAGS.AUTH} ${message}`, data || '')
  },
  realtime: (message, data) => {
    console.log(`${LOG_TAGS.REALTIME} ${message}`, data || '')
  },
  error: (message, error) => {
    console.error(`${LOG_TAGS.ERROR} ${message}`, error?.message || error || '')
    if (isDev() && error?.stack) {
      console.error(`${LOG_TAGS.ERROR} Stack:`, error.stack)
    }
  },
  warn: (message, data) => {
    console.warn(`${LOG_TAGS.WARN} ${message}`, data || '')
  },
  info: (message, data) => {
    console.log(`${LOG_TAGS.INFO} ${message}`, data || '')
  },
  debug: (message, data) => {
    if (isDev()) {
      console.log(`${LOG_TAGS.DEBUG} ${message}`, data || '')
    }
  },
}

module.exports = { logger, LOG_TAGS }
