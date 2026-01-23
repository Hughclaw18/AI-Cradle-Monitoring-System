import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Fallback to the provided Render DB URL if DATABASE_URL is not set
// WARNING: This is for debugging/convenience. In production, use Environment Variables.
const FALLBACK_DB_URL = "postgresql://admin:i8kHXHKSz9GWOkt8CZ4AgNgyj5gn5ofc@dpg-d5plbp7pm1nc73c3n5vg-a.oregon-postgres.render.com/scm_db_35pg";

const DB_URL = process.env.DATABASE_URL || FALLBACK_DB_URL;

if (!DB_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("render.com") || 
       DB_URL.includes("neon.tech") || 
       DB_URL.includes("ssl=true")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });
