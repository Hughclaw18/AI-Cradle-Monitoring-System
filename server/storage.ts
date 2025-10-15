import { 
  SensorData, 
  ServoStatus, 
  MusicStatus, 
  SystemSettings, 
  Track,
  InsertSensorData, 
  InsertServoStatus, 
  InsertMusicStatus, 
  InsertSystemSettings, 
  InsertTrack 
} from "@shared/schema";

export interface IStorage {
  // Sensor data
  insertSensorData(data: InsertSensorData): Promise<SensorData>;
  getLatestSensorData(): Promise<SensorData | undefined>;
  
  // Servo status
  insertServoStatus(status: InsertServoStatus): Promise<ServoStatus>;
  getLatestServoStatus(): Promise<ServoStatus | undefined>;
  updateServoPosition(position: number): Promise<ServoStatus>;
  
  // Music status
  insertMusicStatus(status: InsertMusicStatus): Promise<MusicStatus>;
  getLatestMusicStatus(): Promise<MusicStatus | undefined>;
  updateMusicStatus(status: Partial<InsertMusicStatus>): Promise<MusicStatus>;
  
  // System settings
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings>;
  
  // Tracks
  getAllTracks(): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  insertTrack(track: InsertTrack): Promise<Track>;
}

export class MemStorage implements IStorage {
  private sensorData: SensorData[] = [];
  private servoStatus: ServoStatus[] = [];
  private musicStatus: MusicStatus[] = [];
  private systemSettings: SystemSettings | undefined;
  private tracks: Track[] = [];
  private currentId = 1;

  constructor() {
    // Initialize with default settings
    this.systemSettings = {
      id: 1,
      tempThreshold: 78,
      motionSensitivity: 3,
      cryingDetectionEnabled: true,
      autoResponse: true,
      nightMode: false,
      pushNotifications: true,
      tempAlerts: true,
      motionAlerts: false,
    };

    // Initialize with default tracks
    this.tracks = [
      { id: 1, name: "Brahms Lullaby", filename: "brahms-lullaby.mp3", duration: 242, artist: "Classical" },
      { id: 2, name: "Twinkle Twinkle", filename: "twinkle-twinkle.mp3", duration: 204, artist: "Traditional" },
      { id: 3, name: "Mozart Lullaby", filename: "mozart-lullaby.mp3", duration: 318, artist: "Classical" },
      { id: 4, name: "Rock-a-bye Baby", filename: "rock-a-bye-baby.mp3", duration: 156, artist: "Traditional" },
      { id: 5, name: "Hush Little Baby", filename: "hush-little-baby.mp3", duration: 187, artist: "Traditional" },
    ];

    // Initialize with default sensor data
    this.sensorData.push({
      id: 1,
      temperature: 72.5,
      motionDetected: false,
      cryingDetected: false,
      timestamp: new Date(),
    });

    // Initialize with default servo status
    this.servoStatus.push({
      id: 1,
      position: 45,
      isMoving: false,
      autoRock: false,
      timestamp: new Date(),
    });

    // Initialize with default music status
    this.musicStatus.push({
      id: 1,
      currentTrack: "Brahms Lullaby",
      isPlaying: false,
      volume: 65,
      progress: 0,
      spotifyConnected: false,
      spotifyPlaylistId: null,
      spotifyPlaylistName: null,
      useSpotify: false,
      timestamp: new Date(),
    });
  }

  async insertSensorData(data: InsertSensorData): Promise<SensorData> {
    const newData: SensorData = {
      ...data,
      id: this.currentId++,
      timestamp: new Date(),
    };
    this.sensorData.push(newData);
    return newData;
  }

  async getLatestSensorData(): Promise<SensorData | undefined> {
    return this.sensorData[this.sensorData.length - 1];
  }

  async insertServoStatus(status: InsertServoStatus): Promise<ServoStatus> {
    const newStatus: ServoStatus = {
      ...status,
      id: this.currentId++,
      timestamp: new Date(),
    };
    this.servoStatus.push(newStatus);
    return newStatus;
  }

  async getLatestServoStatus(): Promise<ServoStatus | undefined> {
    return this.servoStatus[this.servoStatus.length - 1];
  }

  async updateServoPosition(position: number): Promise<ServoStatus> {
    const latest = await this.getLatestServoStatus();
    return this.insertServoStatus({
      position,
      isMoving: latest?.isMoving || false,
      autoRock: latest?.autoRock || false,
    });
  }

  async insertMusicStatus(status: InsertMusicStatus): Promise<MusicStatus> {
    const newStatus: MusicStatus = {
      ...status,
      id: this.currentId++,
      timestamp: new Date(),
    };
    this.musicStatus.push(newStatus);
    return newStatus;
  }

  async getLatestMusicStatus(): Promise<MusicStatus | undefined> {
    return this.musicStatus[this.musicStatus.length - 1];
  }

  async updateMusicStatus(status: Partial<InsertMusicStatus>): Promise<MusicStatus> {
    const latest = await this.getLatestMusicStatus();
    return this.insertMusicStatus({
      currentTrack: latest?.currentTrack || null,
      isPlaying: latest?.isPlaying || false,
      volume: latest?.volume || 50,
      progress: latest?.progress || 0,
      spotifyConnected: latest?.spotifyConnected || false,
      spotifyPlaylistId: latest?.spotifyPlaylistId || null,
      spotifyPlaylistName: latest?.spotifyPlaylistName || null,
      useSpotify: latest?.useSpotify || false,
      ...status,
    });
  }

  async getSystemSettings(): Promise<SystemSettings | undefined> {
    return this.systemSettings;
  }

  async updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    if (this.systemSettings) {
      this.systemSettings = { ...this.systemSettings, ...settings };
    }
    return this.systemSettings!;
  }

  async getAllTracks(): Promise<Track[]> {
    return this.tracks;
  }

  async getTrack(id: number): Promise<Track | undefined> {
    return this.tracks.find(track => track.id === id);
  }

  async insertTrack(track: InsertTrack): Promise<Track> {
    const newTrack: Track = {
      ...track,
      id: this.currentId++,
    };
    this.tracks.push(newTrack);
    return newTrack;
  }
}

export const storage = new MemStorage();
