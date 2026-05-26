const pool = require('../connection')

const ensureColumn = async (client, table, name, sql) => {
  const check = await client.query(
    'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
    [table, name]
  )
  if (check.rows.length === 0) {
    await client.query(sql)
    console.log('✓ Added ' + name + ' column to ' + table)
  } else {
    console.log('✓ ' + name + ' column already exists in ' + table)
  }
}

async function addOrderLifecycleColumns() {
  const client = await pool.connect()
  try {
    // Orders table columns
    const ordersCols = [
      { name: 'cancelled_at', sql: 'ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP NULL' },
      { name: 'delivered_at', sql: 'ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP NULL' },
      { name: 'picked_up_at', sql: 'ALTER TABLE orders ADD COLUMN picked_up_at TIMESTAMP NULL' },
      { name: 'delivery_assigned_at', sql: 'ALTER TABLE orders ADD COLUMN delivery_assigned_at TIMESTAMP NULL' },
      { name: 'cancellation_reason', sql: 'ALTER TABLE orders ADD COLUMN cancellation_reason TEXT DEFAULT NULL' },
      { name: 'payment_status', sql: "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(40) DEFAULT 'pending'" },
      { name: 'delivery_partner_id', sql: 'ALTER TABLE orders ADD COLUMN delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL' },
      { name: 'delivery_status', sql: "ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'PENDING'" },
      { name: 'payment_type', sql: 'ALTER TABLE orders ADD COLUMN payment_type VARCHAR(50)' },
      { name: 'cash_collected', sql: 'ALTER TABLE orders ADD COLUMN cash_collected BOOLEAN DEFAULT FALSE' },
      { name: 'collected_cash_amount', sql: 'ALTER TABLE orders ADD COLUMN collected_cash_amount DECIMAL(10, 2) DEFAULT 0' },
      { name: 'cash_collected_at', sql: 'ALTER TABLE orders ADD COLUMN cash_collected_at TIMESTAMP NULL' },
      { name: 'rider_assignment_status', sql: "ALTER TABLE orders ADD COLUMN rider_assignment_status VARCHAR(50) DEFAULT 'UNASSIGNED'" },
      { name: 'assignment_expires_at', sql: 'ALTER TABLE orders ADD COLUMN assignment_expires_at TIMESTAMP NULL' },
      { name: 'delivery_completed_at', sql: 'ALTER TABLE orders ADD COLUMN delivery_completed_at TIMESTAMP NULL' },
    ]
    for (const col of ordersCols) {
      await ensureColumn(client, 'orders', col.name, col.sql)
    }

    await client.query(`
      UPDATE orders
      SET payment_type = payment_method
      WHERE payment_type IS NULL
    `)

    // delivery_assignments table columns
    const assignCols = [
      { name: 'cancelled_at', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL' },
      { name: 'delivered_at', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL' },
      { name: 'delivery_assigned_at', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMP NULL' },
      { name: 'expires_at', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL' },
      { name: 'responded_at', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP NULL' },
      { name: 'rejection_reason', sql: 'ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS rejection_reason TEXT' },
    ]
    for (const col of assignCols) {
      await ensureColumn(client, 'delivery_assignments', col.name, col.sql)
    }

    // active_deliveries table columns
    const activeCols = [
      { name: 'cancelled_at', sql: 'ALTER TABLE active_deliveries ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL' },
      { name: 'delivered_at', sql: 'ALTER TABLE active_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL' },
      { name: 'delivery_assigned_at', sql: 'ALTER TABLE active_deliveries ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMP NULL' },
    ]
    for (const col of activeCols) {
      await ensureColumn(client, 'active_deliveries', col.name, col.sql)
    }

    // delivery_tracking table columns (referenced by order lifecycle SQL)
    const trackingCols = [
      { name: 'cancelled_at', sql: 'ALTER TABLE delivery_tracking ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL' },
      { name: 'delivered_at', sql: 'ALTER TABLE delivery_tracking ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL' },
    ]
    for (const col of trackingCols) {
      await ensureColumn(client, 'delivery_tracking', col.name, col.sql)
    }

    // delivery_status_logs table columns (referenced by completion service)
    const statusLogCols = [
      { name: 'cancelled_at', sql: 'ALTER TABLE delivery_status_logs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL' },
      { name: 'delivered_at', sql: 'ALTER TABLE delivery_status_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL' },
    ]
    for (const col of statusLogCols) {
      await ensureColumn(client, 'delivery_status_logs', col.name, col.sql)
    }

    console.log('✓ Order lifecycle columns migration complete')
  } catch (error) {
    console.error('Failed to add order lifecycle columns:', error.message)
    throw error
  } finally {
    client.release()
  }
}

module.exports = addOrderLifecycleColumns
