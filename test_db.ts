import 'dotenv/config';
import { db, pool } from "./server/db";
import * as schema from "./shared/schema";

async function testDbConnection() {
  console.log("Attempting to connect to the database...");
  try {
    // Try to connect to the pool
    const client = await pool.connect();
    console.log("Successfully connected to the database pool.");
    client.release(); // Release the client back to the pool

    // Try a simple query to verify Drizzle ORM is working
    const users = await db.select().from(schema.users);
    console.log("Successfully executed a test query.");
    console.log(`Found ${users.length} users in the database.`);
    if (users.length > 0) {
      console.log("First user:", users[0]);
    } else {
      console.log("No users found in the database. Please register first.");
    }

    console.log("Database connection test successful!");
  } catch (error) {
    console.error("Database connection test failed:", error);
    process.exit(1); // Exit with an error code
  } finally {
    await pool.end(); // Close the pool connection
    console.log("Database pool closed.");
  }
}

testDbConnection();
