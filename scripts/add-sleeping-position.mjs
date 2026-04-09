import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS sleeping_position TEXT DEFAULT 'Unknown'`);
  console.log('✓ sleeping_position column added (or already exists)');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
