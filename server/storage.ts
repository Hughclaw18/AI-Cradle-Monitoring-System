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
import { eq, desc, and } from "drizzle-orm";
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

  // Sensor data
  insertSensorData(data: InsertSensorData): Promise<SensorData>;
  getLatestSensorData(userId?: number): Promise<SensorData | undefined>;
  
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
    const [config] = await db.select().from(spotifyConfig).where(eq(spotifyConfig.userId, userId));
    return config;
  }

  async createSpotifyConfig(config: InsertSpotifyConfig): Promise<SpotifyConfig> {
    const [newConfig] = await db.insert(spotifyConfig).values(config).returning();
    return newConfig;
  }

  async updateSpotifyConfig(userId: number, config: Partial<InsertSpotifyConfig>): Promise<SpotifyConfig> {
    const [updated] = await db
      .update(spotifyConfig)
      .set(config)
      .where(eq(spotifyConfig.userId, userId))
      .returning();
    return updated;
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
