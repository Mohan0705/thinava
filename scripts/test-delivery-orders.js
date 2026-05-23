require('dotenv').config({ path: './server/.env' });
const pool = require('./server/src/database/connection');

(async () => {
  try {
    console.log('Database URL:', process.env.DATABASE_URL ? 'Loaded' : 'Not loaded');
    
    // Get all orders
    const allOrders = await pool.query('SELECT id, status, delivery_status, delivery_partner_id FROM orders LIMIT 5');
    console.log('\n=== ALL ORDERS ===');
    console.log(allOrders.rows);
    
    // Get available orders for delivery (using our fixed query)
    const availableOrders = await pool.query(`
      SELECT o.id, o.status, o.delivery_status, o.delivery_partner_id
      FROM orders o
      WHERE o.delivery_status = 'PENDING'
        AND o.delivery_partner_id IS NULL
        AND o.status NOT IN ('cancelled', 'delivered')
      LIMIT 10
    `);
    console.log('\n=== AVAILABLE ORDERS FOR DELIVERY ===');
    console.log(availableOrders.rows);
    console.log('Total available for delivery:', availableOrders.rows.length);
    
    pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
