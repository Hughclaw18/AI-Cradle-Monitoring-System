import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import fs from "fs";
import path from "path";

// Configuration for database selection
const AWS_PY_PATH = path.resolve(process.cwd(), "AWS.py");
let useAWS = false;

try {
  if (fs.existsSync(AWS_PY_PATH)) {
    const content = fs.readFileSync(AWS_PY_PATH, "utf-8");
    useAWS = content.includes("USE_AWS = True");
  }
} catch (error) {
  console.error("Error reading AWS.py:", error);
}

const AWS_DB_URL = "postgresql://prajeet:RXcKgDPoKBzOO2c0Xlv5@cradle-db.csxg88kc61xw.us-east-1.rds.amazonaws.com:5432/creadle-db";
const FALLBACK_LOCAL_DB_URL = "postgresql://root:password@localhost:5432/smart_cradle";
const ENV_DB_URL = process.env.DATABASE_URL;

let DB_URL: string;
let mode: string;

if (useAWS) {
  DB_URL = AWS_DB_URL;
  mode = "AWS RDS";
} else if (ENV_DB_URL) {
  DB_URL = ENV_DB_URL;
  if (ENV_DB_URL.includes("localhost")) {
    mode = "Local DB (from .env)";
  } else if (ENV_DB_URL.includes("railway.app") || ENV_DB_URL.includes("rlwy.net")) {
    mode = "Remote (Railway)";
  } else if (ENV_DB_URL.includes("render.com")) {
    mode = "Remote (Render)";
  } else {
    mode = "Remote (Other)";
  }
} else {
  DB_URL = FALLBACK_LOCAL_DB_URL;
  mode = "Local DB (Fallback)";
}

console.log(`Database Mode: ${mode}`);
const hostPort = DB_URL.split('@')[1] ? DB_URL.split('@')[1].split('/')[0] : "localhost";
console.log(`Using Database: ${hostPort}`); 

if (!DB_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("render.com") || 
       DB_URL.includes("neon.tech") || 
       DB_URL.includes("railway.app") ||
       DB_URL.includes("rlwy.net") ||
       DB_URL.includes("ssl=true") ||
       DB_URL.includes("rds.amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Wait 5 seconds for a connection
});

// Error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

// Periodic keep-alive query to prevent idle timeouts
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (err) {
    console.error('Database keep-alive failed:', (err as Error).message);
  }
}, 60000); // Every 1 minute

export const db = drizzle(pool, { schema });
