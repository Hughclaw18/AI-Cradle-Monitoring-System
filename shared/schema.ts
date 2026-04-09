import { pgTable, text, serial, integer, boolean, real, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
  userId: integer("user_id"), // Added for mapping session to user
  userUuid: text("user_uuid"), // Added for mapping session to user UUID
});

export const webcams = pgTable("webcams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().default("webrtc"), // webrtc, mjpeg, hls
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spotifyConfig = pgTable("spotify_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"), // Unix timestamp in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensorData = pgTable("sensor_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  temperature: real("temperature").notNull(),
  objectDetected: text("object_detected").$type<{
    object_name: string;
    timestamp: string;
    detection_id: string;
  }[] | null>(),
  cryingDetected: boolean("crying_detected").notNull().default(false),
  sleepingPosition: text("sleeping_position").default("Unknown"),
});

export const servoStatus = pgTable("servo_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  position: integer("position").notNull().default(0), // 0-180 degrees
  isMoving: boolean("is_moving").notNull().default(false),
  autoRock: boolean("auto_rock").notNull().default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const musicStatus = pgTable("music_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  currentTrack: text("current_track"),
  currentTrackArtist: text("current_track_artist"),
  currentTrackAlbum: text("current_track_album"),
  currentTrackImageUrl: text("current_track_image_url"),
  isPlaying: boolean("is_playing").notNull().default(false),
  volume: integer("volume").notNull().default(50), // 0-100
  progress: real("progress").notNull().default(0), // 0-1
  spotifyConnected: boolean("spotify_connected").notNull().default(false),
  spotifyPlaylistId: text("spotify_playlist_id"),
  spotifyPlaylistName: text("spotify_playlist_name"),
  useSpotify: boolean("use_spotify").notNull().default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tempThreshold: real("temp_threshold").notNull().default(78),
  motionSensitivity: integer("motion_sensitivity").notNull().default(3), // 1-5
  cryingDetectionEnabled: boolean("crying_detection_enabled").notNull().default(true),
  autoResponse: boolean("auto_response").notNull().default(true),
  nightMode: boolean("night_mode").notNull().default(false),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  tempAlerts: boolean("temp_alerts").notNull().default(true),
  motionAlerts: boolean("motion_alerts").notNull().default(false),
  enableLocalWebcam: boolean("enable_local_webcam").notNull().default(false),
});

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  duration: integer("duration").notNull(), // in seconds
  artist: text("artist").default("Unknown"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    phone: z.string().min(1, "Phone is required"),
  });

export const insertWebcamSchema = createInsertSchema(webcams).omit({
  id: true,
  createdAt: true,
});

export const insertSpotifyConfigSchema = createInsertSchema(spotifyConfig).omit({
  id: true,
  createdAt: true,
});

export const insertSensorDataSchema = createInsertSchema(sensorData).omit({
  id: true,
  timestamp: true,
});

export const insertServoStatusSchema = createInsertSchema(servoStatus).omit({
  id: true,
  timestamp: true,
});

export const insertMusicStatusSchema = createInsertSchema(musicStatus).omit({
  id: true,
  timestamp: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Webcam = typeof webcams.$inferSelect;
export type InsertWebcam = z.infer<typeof insertWebcamSchema>;

export type SpotifyConfig = typeof spotifyConfig.$inferSelect;
export type InsertSpotifyConfig = z.infer<typeof insertSpotifyConfigSchema>;

export type SensorData = typeof sensorData.$inferSelect;
export type InsertSensorData = typeof sensorData.$inferInsert;

export type ServoStatus = typeof servoStatus.$inferSelect;
export type InsertServoStatus = z.infer<typeof insertServoStatusSchema>;

export type MusicStatus = typeof musicStatus.$inferSelect;
export type InsertMusicStatus = z.infer<typeof insertMusicStatusSchema>;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;

export interface NotificationData {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}
