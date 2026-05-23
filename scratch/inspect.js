const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    const res = await pool.query("SELECT * FROM delivery_partners WHERE phone = '9866226150'");
    console.log('RIDER:', res.rows[0]);
    if (res.rows[0]) {
      const logs = await pool.query("SELECT * FROM rider_approval_logs WHERE delivery_partner_id = $1 ORDER BY created_at DESC", [res.rows[0].id]);
      console.log('LOGS:', logs.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
