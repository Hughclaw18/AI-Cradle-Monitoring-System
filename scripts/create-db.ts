import pg from 'pg';

async function createDatabase() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:user@localhost:5434/postgres'
  });

  try {
    await pool.query('CREATE DATABASE smart_cradle');
    console.log('Database smart_cradle created successfully!');
  } catch (err: any) {
    if (err.code === '42P04') {
      console.log('Database smart_cradle already exists.');
    } else {
      console.error('Failed to create database:', err.message);
    }
  } finally {
    await pool.end();
  }
}

createDatabase();
