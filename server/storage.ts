import { 
  User, InsertUser,
  Webcam, InsertWebcam,
  SpotifyConfig, InsertSpotifyConfig,
  SensorData, InsertSensorData,
  ServoStatus, InsertServoStatus,
  MusicStatus, InsertMusicStatus,
  SystemSettings, InsertSystemSettings,
  Track, InsertTrack,
  users, webcams, spotifyConfig, sensorData, servoStatus, musicStatus, systemSettings, tracks
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql as drizzleSql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Webcam
  getWebcams(userId: number): Promise<Webcam[]>;
  createWebcam(webcam: InsertWebcam): Promise<Webcam>;
  deleteWebcam(userId: number, id: number): Promise<void>;

  // Spotify Config
  getSpotifyConfig(userId: number): Promise<SpotifyConfig | undefined>;
  createSpotifyConfig(config: InsertSpotifyConfig): Promise<SpotifyConfig>;
  updateSpotifyConfig(userId: number, config: Partial<InsertSpotifyConfig>): Promise<SpotifyConfig>;
  deleteSpotifyConfig(userId: number): Promise<void>;

  // Sensor data
  insertSensorData(data: InsertSensorData): Promise<SensorData>;
  getLatestSensorData(userId?: number): Promise<SensorData | undefined>;
  getSensorHistory(userId: number, limit: number, offset: number): Promise<SensorData[]>;
  getSensorSummary(userId: number): Promise<{ date: string; crying: number; objects: number; temperature: number; positions: Record<string, number> }[]>;
  getSleepPositionHistory(userId: number, limit: number, offset: number): Promise<{ id: number; timestamp: Date; sleepingPosition: string | null }[]>;
  
  // Servo status
  insertServoStatus(status: InsertServoStatus): Promise<ServoStatus>;
  getLatestServoStatus(userId: number): Promise<ServoStatus | undefined>;
  updateServoPosition(userId: number, position: number): Promise<ServoStatus>;
  
  // Music status
  insertMusicStatus(status: InsertMusicStatus): Promise<MusicStatus>;
  getLatestMusicStatus(userId: number): Promise<MusicStatus | undefined>;
  updateMusicStatus(userId: number, status: Partial<InsertMusicStatus>): Promise<MusicStatus>;
  
  // System settings
  getSystemSettings(userId: number): Promise<SystemSettings | undefined>;
  updateSystemSettings(userId: number, settings: Partial<InsertSystemSettings>): Promise<SystemSettings>;
  
  // Tracks
  getAllTracks(): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  insertTrack(track: InsertTrack): Promise<Track>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Webcam
  async getWebcams(userId: number): Promise<Webcam[]> {
    return db.select().from(webcams).where(eq(webcams.userId, userId));
  }

  async createWebcam(webcam: InsertWebcam): Promise<Webcam> {
    const [newWebcam] = await db.insert(webcams).values(webcam).returning();
    return newWebcam;
  }

  async deleteWebcam(userId: number, id: number): Promise<void> {
    await db.delete(webcams).where(and(eq(webcams.id, id), eq(webcams.userId, userId)));
  }

  // Spotify Config
  async getSpotifyConfig(userId: number): Promise<SpotifyConfig | undefined> {
    const [config] = await db.select().from(spotifyConfig).where(eq(spotifyConfig.userId, userId)).orderBy(desc(spotifyConfig.id)).limit(1);
    return config;
  }

  async createSpotifyConfig(config: InsertSpotifyConfig): Promise<SpotifyConfig> {
    const existing = await this.getSpotifyConfig(config.userId);
    if (existing) {
      return this.updateSpotifyConfig(config.userId, config);
    }
    const [newConfig] = await db.insert(spotifyConfig).values(config).returning();
    return newConfig;
  }

  async updateSpotifyConfig(userId: number, config: Partial<InsertSpotifyConfig>): Promise<SpotifyConfig> {
    // Update the most recent config for this user
    // Since we don't have unique constraint, we should target the specific ID if possible, 
    // but getSpotifyConfig returns the latest, so let's get that ID first.
    
    const existing = await this.getSpotifyConfig(userId);
    if (!existing) {
        throw new Error("No Spotify config found to update");
    }

    const [updated] = await db
      .update(spotifyConfig)
      .set(config)
      .where(eq(spotifyConfig.id, existing.id))
      .returning();
    return updated;
  }

  async deleteSpotifyConfig(userId: number): Promise<void> {
    console.log(`[Storage] Deleting Spotify config for user ${userId}`);
    await db.delete(spotifyConfig).where(eq(spotifyConfig.userId, userId));
    console.log(`[Storage] Deleted Spotify config for user ${userId}`);
  }

  // Sensor Data
  async insertSensorData(data: InsertSensorData): Promise<SensorData> {
    const [newData] = await db.insert(sensorData).values(data).returning();
    return newData;
  }

  async getLatestSensorData(userId?: number): Promise<SensorData | undefined> {
    if (userId) {
      const [latest] = await db.select().from(sensorData).where(eq(sensorData.userId, userId)).orderBy(desc(sensorData.timestamp)).limit(1);
      return latest;
    }
    const [latest] = await db.select().from(sensorData).orderBy(desc(sensorData.timestamp)).limit(1);
    return latest;
  }

  async getSensorHistory(userId: number, limit: number, offset: number): Promise<SensorData[]> {
    return db
      .select()
      .from(sensorData)
      .where(eq(sensorData.userId, userId))
      .orderBy(desc(sensorData.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getSensorSummary(userId: number): Promise<{ date: string; crying: number; objects: number; temperature: number; positions: Record<string, number> }[]> {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select()
      .from(sensorData)
      .where(and(eq(sensorData.userId, userId), gte(sensorData.timestamp, since)))
      .orderBy(desc(sensorData.timestamp));

    const byDay: Record<string, { date: string; crying: number; objects: number; temperature: number; positions: Record<string, number> }> = {};
    for (const row of rows) {
      const day = row.timestamp.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, crying: 0, objects: 0, temperature: 0, positions: {} };
      if (row.cryingDetected) byDay[day].crying += 1;
      const objs = Array.isArray(row.objectDetected) ? row.objectDetected : [];
      byDay[day].objects += objs.length;
      if (row.temperature > 78) byDay[day].temperature += 1;
      const pos = (row as any).sleepingPosition || "Unknown";
      if (pos && pos !== "Unknown") {
        byDay[day].positions[pos] = (byDay[day].positions[pos] || 0) + 1;
      }
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSleepPositionHistory(userId: number, limit: number, offset: number): Promise<{ id: number; timestamp: Date; sleepingPosition: string | null }[]> {
    const rows = await db
      .select()
      .from(sensorData)
      .where(eq(sensorData.userId, userId))
      .orderBy(desc(sensorData.timestamp))
      .limit(limit)
      .offset(offset);
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      sleepingPosition: (r as any).sleepingPosition ?? null,
    }));
  }

  // Servo Status
  async insertServoStatus(status: InsertServoStatus): Promise<ServoStatus> {
    const [newStatus] = await db.insert(servoStatus).values(status).returning();
    return newStatus;
  }

  async getLatestServoStatus(userId: number): Promise<ServoStatus | undefined> {
    const [latest] = await db.select().from(servoStatus).where(eq(servoStatus.userId, userId)).orderBy(desc(servoStatus.timestamp)).limit(1);
    return latest;
  }

  async updateServoPosition(userId: number, position: number): Promise<ServoStatus> {
    const latest = await this.getLatestServoStatus(userId);
    const newStatus = {
      ...(latest || { userId }),
      userId,
      position,
      isMoving: latest?.isMoving ?? false,
      autoRock: latest?.autoRock ?? false,
    };
    // @ts-ignore
    delete newStatus.id;
    // @ts-ignore
    delete newStatus.timestamp;
    
    return this.insertServoStatus(newStatus as InsertServoStatus);
  }

  // Music Status
  async insertMusicStatus(status: InsertMusicStatus): Promise<MusicStatus> {
    const [newStatus] = await db.insert(musicStatus).values(status).returning();
    return newStatus;
  }

  async getLatestMusicStatus(userId: number): Promise<MusicStatus | undefined> {
    const [latest] = await db.select().from(musicStatus).where(eq(musicStatus.userId, userId)).orderBy(desc(musicStatus.timestamp)).limit(1);
    return latest;
  }

  async updateMusicStatus(userId: number, status: Partial<InsertMusicStatus>): Promise<MusicStatus> {
    const latest = await this.getLatestMusicStatus(userId);
    const newStatus = {
      ...(latest || { userId }),
      userId,
      ...status,
    };
    // @ts-ignore
    delete newStatus.id;
    // @ts-ignore
    delete newStatus.timestamp;
    
    return this.insertMusicStatus(newStatus as InsertMusicStatus);
  }

  // System Settings
  async getSystemSettings(userId: number): Promise<SystemSettings | undefined> {
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.userId, userId)).orderBy(desc(systemSettings.id)).limit(1);
    return settings;
  }

  async updateSystemSettings(userId: number, settings: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    const current = await this.getSystemSettings(userId);
    if (current) {
      const [updated] = await db
        .update(systemSettings)
        .set(settings)
        .where(eq(systemSettings.id, current.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemSettings).values({ ...settings, userId } as InsertSystemSettings).returning();
      return created;
    }
  }

  // Tracks
  async getAllTracks(): Promise<Track[]> {
    return db.select().from(tracks);
  }

  async getTrack(id: number): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
    return track;
  }

  async insertTrack(track: InsertTrack): Promise<Track> {
    const [newTrack] = await db.insert(tracks).values(track).returning();
    return newTrack;
  }
}

export const storage = new DatabaseStorage();
