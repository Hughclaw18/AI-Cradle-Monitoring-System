import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const rows = await pool.query(`SELECT DISTINCT sleeping_position FROM sensor_data WHERE sleeping_position IS NOT NULL ORDER BY sleeping_position`);
  console.log('All distinct sleeping_position values:');
  rows.rows.forEach(r => console.log(' -', JSON.stringify(r.sleeping_position)));
} catch(e) {
  console.error(e.message);
} finally {
  await pool.end();
}
