const pool = require('../src/database/connection')

pool
  .query(
    `SELECT column_name, data_type, ordinal_position
     FROM information_schema.columns
     WHERE table_name = 'restaurants'
     ORDER BY ordinal_position`
  )
  .then((result) => {
    console.log(result.rows)
    return pool.end()
  })
  .catch((error) => {
    console.error(error)
    return pool.end()
  })
