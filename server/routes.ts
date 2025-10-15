import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertSystemSettingsSchema, insertMusicStatusSchema, insertServoStatusSchema } from "@shared/schema";
import { z } from "zod";
import { getUncachableSpotifyClient, isSpotifyConnected } from "./spotify";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // API Routes
  
  // Get latest sensor data
  app.get("/api/sensors/latest", async (req, res) => {
    try {
      const data = await storage.getLatestSensorData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get sensor data" });
    }
  });

  // Get latest servo status
  app.get("/api/servo/status", async (req, res) => {
    try {
      const status = await storage.getLatestServoStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get servo status" });
    }
  });

  // Update servo position
  app.post("/api/servo/position", async (req, res) => {
    try {
      const { position } = req.body;
      if (typeof position !== 'number' || position < 0 || position > 180) {
        return res.status(400).json({ error: "Position must be between 0 and 180" });
      }
      const status = await storage.updateServoPosition(position);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to update servo position" });
    }
  });

  // Update servo settings
  app.post("/api/servo/settings", async (req, res) => {
    try {
      const servoSettings = insertServoStatusSchema.parse(req.body);
      const status = await storage.insertServoStatus(servoSettings);
      res.json(status);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid servo settings", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update servo settings" });
      }
    }
  });

  // Get music status
  app.get("/api/music/status", async (req, res) => {
    try {
      const status = await storage.getLatestMusicStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get music status" });
    }
  });

  // Update music status
  app.post("/api/music/status", async (req, res) => {
    try {
      const musicStatus = insertMusicStatusSchema.partial().parse(req.body);
      const status = await storage.updateMusicStatus(musicStatus);
      res.json(status);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid music status", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update music status" });
      }
    }
  });

  // Get all tracks
  app.get("/api/tracks", async (req, res) => {
    try {
      const tracks = await storage.getAllTracks();
      res.json(tracks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tracks" });
    }
  });

  // Spotify Routes
  
  // Check Spotify connection status
  app.get("/api/spotify/status", async (req, res) => {
    try {
      const connected = await isSpotifyConnected();
      const musicStatus = await storage.getLatestMusicStatus();
      res.json({ 
        connected,
        playlistId: musicStatus?.spotifyPlaylistId,
        playlistName: musicStatus?.spotifyPlaylistName,
        useSpotify: musicStatus?.useSpotify
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check Spotify status" });
    }
  });

  // Get user's Spotify playlists
  app.get("/api/spotify/playlists", async (req, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const playlists = await spotify.currentUser.playlists.playlists(50);
      res.json(playlists.items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch playlists", message: error.message });
    }
  });

  // Set active Spotify playlist
  app.post("/api/spotify/playlist", async (req, res) => {
    try {
      const { playlistId, playlistName } = req.body;
      if (!playlistId || !playlistName) {
        return res.status(400).json({ error: "Playlist ID and name are required" });
      }
      
      const musicStatus = await storage.updateMusicStatus({
        spotifyConnected: true,
        spotifyPlaylistId: playlistId,
        spotifyPlaylistName: playlistName,
        useSpotify: true,
      });
      
      res.json(musicStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to set playlist" });
    }
  });

  // Play from Spotify playlist
  app.post("/api/spotify/play", async (req, res) => {
    try {
      const musicStatus = await storage.getLatestMusicStatus();
      if (!musicStatus?.spotifyPlaylistId) {
        return res.status(400).json({ error: "No playlist selected" });
      }

      const spotify = await getUncachableSpotifyClient();
      
      // Get user's available devices
      const devices = await spotify.player.getAvailableDevices();
      
      if (devices.devices.length === 0) {
        return res.status(400).json({ error: "No active Spotify devices found. Please open Spotify on a device first." });
      }

      // Play the playlist on the first available device
      await spotify.player.startResumePlayback(
        devices.devices[0].id!,
        musicStatus.spotifyPlaylistId
      );

      await storage.updateMusicStatus({
        isPlaying: true,
        currentTrack: musicStatus.spotifyPlaylistName || "Spotify Playlist",
      });

      res.json({ success: true, message: "Playing from Spotify" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to play from Spotify", message: error.message });
    }
  });

  // Pause Spotify playback
  app.post("/api/spotify/pause", async (req, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const devices = await spotify.player.getAvailableDevices();
      
      if (devices.devices.length > 0) {
        await spotify.player.pausePlayback(devices.devices[0].id!);
      }
      
      await storage.updateMusicStatus({
        isPlaying: false,
      });

      res.json({ success: true, message: "Spotify playback paused" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to pause Spotify", message: error.message });
    }
  });

  // Get system settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  // Update system settings
  app.post("/api/settings", async (req, res) => {
    try {
      const settings = insertSystemSettingsSchema.partial().parse(req.body);
      const updatedSettings = await storage.updateSystemSettings(settings);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid settings", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update settings" });
      }
    }
  });

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');

    // Send initial data
    const sendInitialData = async () => {
      try {
        const sensorData = await storage.getLatestSensorData();
        const servoStatus = await storage.getLatestServoStatus();
        const musicStatus = await storage.getLatestMusicStatus();
        const settings = await storage.getSystemSettings();

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'initial_data',
            data: {
              sensors: sensorData,
              servo: servoStatus,
              music: musicStatus,
              settings: settings
            }
          }));
        }
      } catch (error) {
        console.error('Error sending initial data:', error);
      }
    };

    sendInitialData();

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (message: any) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };

  // Simulate real-time sensor data updates
  setInterval(async () => {
    try {
      const settings = await storage.getSystemSettings();
      const currentSensor = await storage.getLatestSensorData();
      
      // Simulate temperature fluctuation
      const newTemp = 72 + Math.random() * 6 - 3; // 69-75°F range
      
      // Simulate motion detection (5% chance)
      const motionDetected = Math.random() < 0.05;
      
      // Simulate crying detection (3% chance, or higher if motion detected)
      const cryingDetected = Math.random() < (motionDetected ? 0.15 : 0.03);
      
      // Update sensor data
      const sensorData = await storage.insertSensorData({
        temperature: newTemp,
        motionDetected,
        cryingDetected,
      });

      // Auto-response to crying
      if (cryingDetected && settings?.autoResponse) {
        const musicStatus = await storage.getLatestMusicStatus();
        if (!musicStatus?.isPlaying) {
          // Use Spotify if enabled and connected
          if (musicStatus?.useSpotify && musicStatus?.spotifyPlaylistId) {
            try {
              const spotify = await getUncachableSpotifyClient();
              const devices = await spotify.player.getAvailableDevices();
              
              if (devices.devices.length > 0) {
                await spotify.player.startResumePlayback(
                  devices.devices[0].id!,
                  musicStatus.spotifyPlaylistId
                );
                
                await storage.updateMusicStatus({
                  isPlaying: true,
                  currentTrack: musicStatus.spotifyPlaylistName || "Spotify Playlist",
                });
              }
            } catch (error) {
              console.error('Failed to play Spotify:', error);
              // Fallback to default track
              await storage.updateMusicStatus({
                isPlaying: true,
                currentTrack: "Brahms Lullaby",
                progress: 0,
              });
            }
          } else {
            // Use built-in music player
            await storage.updateMusicStatus({
              isPlaying: true,
              currentTrack: "Brahms Lullaby",
              progress: 0,
            });
          }
        }
      }

      // Check for temperature alerts
      if (settings?.tempAlerts && newTemp > settings.tempThreshold) {
        broadcast({
          type: 'notification',
          data: {
            title: 'Temperature Alert',
            message: `Temperature is ${newTemp.toFixed(1)}°F, above threshold of ${settings.tempThreshold}°F`,
            severity: 'warning'
          }
        });
      }

      // Check for motion alerts
      if (settings?.motionAlerts && motionDetected) {
        broadcast({
          type: 'notification',
          data: {
            title: 'Motion Detected',
            message: 'Movement detected in the baby\'s room',
            severity: 'info'
          }
        });
      }

      // Check for crying alerts
      if (cryingDetected) {
        broadcast({
          type: 'notification',
          data: {
            title: 'Baby is Crying',
            message: settings?.autoResponse ? 'Music has been started automatically' : 'Please check on the baby',
            severity: 'warning'
          }
        });
      }

      // Broadcast sensor update
      broadcast({
        type: 'sensor_update',
        data: sensorData
      });

    } catch (error) {
      console.error('Error in sensor simulation:', error);
    }
  }, 2000);

  // Simulate servo position updates for auto-rock
  setInterval(async () => {
    try {
      const servoStatus = await storage.getLatestServoStatus();
      if (servoStatus?.autoRock) {
        // Simulate gentle rocking motion
        const time = Date.now() / 1000;
        const newPosition = Math.round(45 + 15 * Math.sin(time * 0.5)); // 30-60 degree range
        
        const updatedStatus = await storage.insertServoStatus({
          position: newPosition,
          isMoving: true,
          autoRock: true,
        });

        broadcast({
          type: 'servo_update',
          data: updatedStatus
        });
      }
    } catch (error) {
      console.error('Error in servo simulation:', error);
    }
  }, 1000);

  // Simulate music progress updates
  setInterval(async () => {
    try {
      const musicStatus = await storage.getLatestMusicStatus();
      if (musicStatus?.isPlaying) {
        const track = await storage.getTrack(1); // Assuming track ID 1 for now
        if (track) {
          const newProgress = (musicStatus.progress + 0.01) % 1; // Increment progress
          
          const updatedStatus = await storage.updateMusicStatus({
            progress: newProgress,
          });

          broadcast({
            type: 'music_update',
            data: updatedStatus
          });
        }
      }
    } catch (error) {
      console.error('Error in music simulation:', error);
    }
  }, 1000);

  return httpServer;
}
