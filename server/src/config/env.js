const REQUIRED = {
  NODE_ENV: { default: 'development' },
  PORT: { default: '5000', parse: Number },
  DATABASE_URL: {},

  CUSTOMER_JWT_SECRET: {},
  ADMIN_JWT_SECRET: {},
  RIDER_JWT_SECRET: {},
  RESTAURANT_JWT_SECRET: {},

  JWT_ISSUER: { default: 'thinava' },
  JWT_AUDIENCE: { default: 'thinava-app' },

  FRONTEND_URL: { default: 'http://localhost:3000', production: true },

  API_RATE_LIMIT_MAX: { default: '1000', parse: Number },
  CUSTOMER_AUTH_SEND_LIMIT_MAX: { default: '10', parse: Number },
  CUSTOMER_AUTH_VERIFY_LIMIT_MAX: { default: '20', parse: Number },

  DEV_MODE: { default: 'true' },
  OTP_EXPIRY_MINUTES: { default: '5', parse: Number },
  OTP_RESEND_COOLDOWN_SECONDS: { default: '30', parse: Number },
  OTP_MAX_ATTEMPTS: { default: '5', parse: Number },

  DELIVERY_BASE_PAY: { default: '0', parse: Number },
  DELIVERY_PER_KM_RATE: { default: '10', parse: Number },
  DELIVERY_NIGHT_PER_KM_RATE: { default: '13', parse: Number },
  DELIVERY_SURGE_BONUS: { default: '10', parse: Number },
  DELIVERY_RAIN_BONUS: { default: '15', parse: Number },
  DELIVERY_GPS_RADIUS_METERS: { default: '75', parse: Number },
  DELIVERY_RAIN_MODE: { default: 'false' },

  SUPPORT_PHONE: { default: '+918978992808' },
  SUPPORT_WHATSAPP: { default: '918978992808' },
  SUPPORT_EMAIL: { default: 'support@thinava.com' },
}

const OPTIONAL = {
  GOOGLE_MAPS_SERVER_KEY: {},
  GOOGLE_MAPS_API_KEY: {},

  RESTAURANT_OWNER_SEED_PASSWORD: {},

  SUPABASE_URL: {},
  NEXT_PUBLIC_SUPABASE_URL: {},
  SUPABASE_ANON_KEY: {},
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {},
  SUPABASE_SERVICE_ROLE_KEY: {},

  CLOUDINARY_CLOUD_NAME: {},
  CLOUDINARY_API_KEY: {},
  CLOUDINARY_API_SECRET: {},
  CLOUDINARY_BANNER_FOLDER: {},

  SUPER_ADMIN_EMAIL: {},
  SUPER_ADMIN_PASSWORD: {},
  OPS_ADMIN_EMAIL: {},
  OPS_ADMIN_PASSWORD: {},
  FINANCE_ADMIN_EMAIL: {},
  FINANCE_ADMIN_PASSWORD: {},
  SUPPORT_ADMIN_EMAIL: {},
  SUPPORT_ADMIN_PASSWORD: {},
}

const resolved = {}
const errors = []

for (const [key, cfg] of Object.entries(REQUIRED)) {
  const raw = process.env[key]
  if (raw !== undefined && raw !== '') {
    resolved[key] = cfg.parse ? cfg.parse(raw) : raw
  } else if (cfg.default !== undefined) {
    resolved[key] = cfg.parse ? cfg.parse(cfg.default) : cfg.default
  } else {
    errors.push(`Missing required environment variable: ${key}`)
  }
}

for (const [key, cfg] of Object.entries(OPTIONAL)) {
  const raw = process.env[key]
  if (raw !== undefined && raw !== '') {
    resolved[key] = raw
  }
}

// Production-specific validation
const isProduction = resolved.NODE_ENV === 'production'
if (isProduction) {
  // In production, FRONTEND_URL must be explicitly set to production domain
  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl || frontendUrl.includes('localhost')) {
    errors.push(
      `In production, FRONTEND_URL must be set to your production domain (e.g., https://thinava.vercel.app)\n    Current: ${frontendUrl || 'NOT SET'}`
    )
  }
}

if (errors.length > 0) {
  console.error('\n=== ENVIRONMENT VALIDATION FAILED ===')
  for (const err of errors) {
    console.error(`  ✗ ${err}`)
  }
  console.error('=====================================\n')
  process.exit(1)
}

const env = resolved

module.exports = env
