const levels = { critical: 0, error: 1, warn: 2, info: 3, debug: 4 }
const isDev = () => process.env.NODE_ENV !== 'production'

let requestId = 'system'

const setRequestId = (id) => { requestId = id }
const getRequestId = () => requestId

const formatEntry = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: meta.requestId || requestId || undefined,
    ...meta,
  }
  if (meta.error instanceof Error) {
    entry.error = { message: meta.error.message, stack: isDev() ? meta.error.stack : undefined }
    delete meta.error
  }
  return entry
}

const log = (level, message, meta = {}) => {
  if (levels[level] === undefined) return
  if (level === 'debug' && !isDev()) return

  const entry = formatEntry(level, message, meta)

  if (level === 'error' || level === 'critical') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

const logger = {
  critical: (message, meta) => log('critical', message, meta),
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  setRequestId,
  getRequestId,
}

module.exports = { logger }
