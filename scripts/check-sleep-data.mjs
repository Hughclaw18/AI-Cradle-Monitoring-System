import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  // Check column exists
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='sensor_data'`);
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

  // Check recent rows
  const rows = await pool.query(`SELECT id, sleeping_position, temperature FROM sensor_data ORDER BY id DESC LIMIT 5`);
  console.log('Recent rows:', JSON.stringify(rows.rows, null, 2));
} catch(e) {
  console.error(e.message);
} finally {
  await pool.end();
}
