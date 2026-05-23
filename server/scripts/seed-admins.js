const path = require('path')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

// Load env files: server/.env first, then root .env.admin, then root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.admin') })
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  OPERATIONS_ADMIN: 'operations_admin',
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
}

const ALL_PERMISSIONS = [
  'dashboard:view', 'orders:view', 'orders:manage',
  'restaurants:view', 'restaurants:manage',
  'delivery:view', 'delivery:manage',
  'customers:view', 'customers:manage',
  'analytics:view',
  'payments:view', 'payments:manage',
  'commissions:view', 'commissions:manage',
  'settlements:view', 'settlements:manage',
  'support:view', 'support:manage',
  'settings:view', 'settings:manage',
  'promotions:view', 'promotions:manage',
  'map:view',
]

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ADMIN_ROLES.OPERATIONS_ADMIN]: [
    'dashboard:view', 'orders:view', 'orders:manage',
    'restaurants:view', 'restaurants:manage',
    'delivery:view', 'delivery:manage',
    'customers:view',
    'map:view',
  ],
  [ADMIN_ROLES.FINANCE_ADMIN]: [
    'dashboard:view', 'analytics:view',
    'payments:view', 'payments:manage',
    'commissions:view', 'commissions:manage',
    'settlements:view', 'settlements:manage',
    'promotions:view', 'settings:view',
  ],
  [ADMIN_ROLES.SUPPORT_ADMIN]: [
    'dashboard:view', 'orders:view',
    'customers:view',
    'support:view', 'support:manage',
    'map:view',
  ],
}

const ADMINS = [
  {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@thinava.com',
    password: process.env.SUPER_ADMIN_PASSWORD,
    fullName: 'Thinava Super Admin',
    role: ADMIN_ROLES.SUPER_ADMIN,
  },
  {
    email: process.env.OPS_ADMIN_EMAIL || 'opsadmin@thinava.com',
    password: process.env.OPS_ADMIN_PASSWORD,
    fullName: 'Thinava Operations Admin',
    role: ADMIN_ROLES.OPERATIONS_ADMIN,
  },
  {
    email: process.env.FINANCE_ADMIN_EMAIL || 'finance@thinava.com',
    password: process.env.FINANCE_ADMIN_PASSWORD,
    fullName: 'Thinava Finance Admin',
    role: ADMIN_ROLES.FINANCE_ADMIN,
  },
  {
    email: process.env.SUPPORT_ADMIN_EMAIL || 'support@thinava.com',
    password: process.env.SUPPORT_ADMIN_PASSWORD,
    fullName: 'Thinava Support Admin',
    role: ADMIN_ROLES.SUPPORT_ADMIN,
  },
]

;(async () => {
  console.log('=== THINAVA Admin Seeder ===\n')

  // Validate required env vars
  const missing = ADMINS.filter(a => !a.password)
  if (missing.length > 0) {
    console.error('ERROR: Missing passwords in .env.admin for:')
    missing.forEach(a => console.error(`  - ${a.email} (${a.role})`))
    console.error('\nMake sure .env.admin exists at the project root with all passwords set.')
    process.exit(1)
  }

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set. Make sure server/.env exists.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    // Test connection
    await pool.query('SELECT 1')
    console.log('✓ Database connected\n')

    // Clear ALL existing admin accounts
    console.log('--- Step 1: Remove old admin accounts ---')
    const deleteResult = await pool.query('DELETE FROM admin_activity_logs')
    console.log(`  Deleted ${deleteResult.rowCount} activity logs`)

    const deleteAdmins = await pool.query('DELETE FROM admin_users')
    console.log(`  Deleted ${deleteAdmins.rowCount} old admin accounts\n`)

    // Hash and insert new admin accounts
    console.log('--- Step 2: Create new admin accounts ---')
    for (const admin of ADMINS) {
      const salt = await bcrypt.genSalt(12)
      const passwordHash = await bcrypt.hash(admin.password, salt)
      const permissions = ROLE_PERMISSIONS[admin.role] || []

      await pool.query(
        `INSERT INTO admin_users (email, password_hash, full_name, role, permissions, is_active)
         VALUES ($1, $2, $3, $4, $5::jsonb, TRUE)`,
        [admin.email, passwordHash, admin.fullName, admin.role, JSON.stringify(permissions)]
      )

      console.log(`  ✓ ${admin.email.padEnd(30)} ${admin.role.padEnd(20)} created`)
    }

    // Verify
    console.log('\n--- Step 3: Verify admin accounts ---')
    const verify = await pool.query(
      'SELECT id, email, full_name, role, is_active, created_at FROM admin_users ORDER BY created_at'
    )
    console.log(`  Found ${verify.rows.length} admin(s):`)
    for (const row of verify.rows) {
      console.log(`  ${row.id.substring(0, 8)}... | ${row.email.padEnd(30)} | ${row.role.padEnd(20)} | active: ${row.is_active}`)
    }

    // Password verification test
    console.log('\n--- Step 4: Password verification test ---')
    for (const admin of ADMINS) {
      const dbRow = await pool.query(
        'SELECT password_hash FROM admin_users WHERE email = $1',
        [admin.email]
      )
      if (dbRow.rows.length === 0) {
        console.log(`  ✗ ${admin.email} NOT FOUND after insert!`)
        continue
      }
      const match = await bcrypt.compare(admin.password, dbRow.rows[0].password_hash)
      console.log(`  ${match ? '✓' : '✗'} ${admin.email.padEnd(30)} password ${match ? 'MATCHES' : 'MISMATCH'}`)
    }

    console.log('\n=== Admin seeding complete ===')
  } catch (err) {
    console.error('\nERROR:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
