import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sensorData = pgTable("sensor_data", {
  id: serial("id").primaryKey(),
  temperature: real("temperature").notNull(),
  motionDetected: boolean("motion_detected").notNull().default(false),
  cryingDetected: boolean("crying_detected").notNull().default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const servoStatus = pgTable("servo_status", {
  id: serial("id").primaryKey(),
  position: integer("position").notNull().default(0), // 0-180 degrees
  isMoving: boolean("is_moving").notNull().default(false),
  autoRock: boolean("auto_rock").notNull().default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const musicStatus = pgTable("music_status", {
  id: serial("id").primaryKey(),
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
  tempThreshold: real("temp_threshold").notNull().default(78),
  motionSensitivity: integer("motion_sensitivity").notNull().default(3), // 1-5
  cryingDetectionEnabled: boolean("crying_detection_enabled").notNull().default(true),
  autoResponse: boolean("auto_response").notNull().default(true),
  nightMode: boolean("night_mode").notNull().default(false),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  tempAlerts: boolean("temp_alerts").notNull().default(true),
  motionAlerts: boolean("motion_alerts").notNull().default(false),
});

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  duration: integer("duration").notNull(), // in seconds
  artist: text("artist").default("Unknown"),
});

// Insert schemas
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
export type SensorData = typeof sensorData.$inferSelect;
export type InsertSensorData = z.infer<typeof insertSensorDataSchema>;

export type ServoStatus = typeof servoStatus.$inferSelect;
export type InsertServoStatus = z.infer<typeof insertServoStatusSchema>;

export type MusicStatus = typeof musicStatus.$inferSelect;
export type InsertMusicStatus = z.infer<typeof insertMusicStatusSchema>;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
