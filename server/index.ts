import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import cors from "cors";
// import { WebSocketServer } from "ws";

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

import { db } from "./db";
import { sql } from "drizzle-orm";

(async () => {
  // --- Create Trigger for Session User UUID ---
  try {
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION sync_session_user_data() RETURNS TRIGGER AS $$
      BEGIN
        -- Extract user ID from sess JSON (passport.user)
        -- Assuming passport stores user ID as integer in sess->'passport'->>'user'
        IF NEW.sess->'passport'->>'user' IS NOT NULL THEN
            NEW.user_id := (NEW.sess->'passport'->>'user')::integer;
            
            -- Fetch UUID from users table
            SELECT uuid INTO NEW.user_uuid FROM users WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_sync_session_user_data ON session;
      
      CREATE TRIGGER trigger_sync_session_user_data
      BEFORE INSERT OR UPDATE ON session
      FOR EACH ROW
      EXECUTE FUNCTION sync_session_user_data();
    `);
    console.log("Session sync trigger created successfully.");
  } catch (error) {
    console.error("Failed to create session sync trigger:", error);
  }

  const httpServer = createServer(app);
  setupAuth(app);

  const server = await registerRoutes(app, httpServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // serve the app on process.env.PORT (Render sets this) or fallback to 3000
  const port = Number(process.env.PORT) || 3000;
  httpServer.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  }).on('error', (err: Error) => {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  });
})();
