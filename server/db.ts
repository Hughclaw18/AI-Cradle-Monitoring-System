import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
const DB_URL = process.env.DATABASE_URL || "";
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
