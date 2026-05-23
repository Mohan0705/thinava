const pool = require('../connection')

async function addNotesToOrderItems() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'notes'
    `)

    if (columnCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE order_items
        ADD COLUMN notes TEXT DEFAULT ''
      `)
      console.log('✓ Added notes column to order_items')
    } else {
      console.log('✓ notes column already exists in order_items')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to add notes column:', error)
    throw error
  } finally {
    client.release()
  }
}

module.exports = addNotesToOrderItems
