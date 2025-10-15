import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertSystemSettingsSchema, insertMusicStatusSchema, insertServoStatusSchema } from "@shared/schema";
import { z } from "zod";
import { getUncachableSpotifyClient, isSpotifyConnected, getSpotifyAuthUrl, exchangeCodeForTokens, getCurrentlyPlayingTrack } from "./spotify";
// Use the official types from the Spotify SDK
import type { SpotifyApi, Device } from "@spotify/web-api-ts-sdk";

/**
 * A helper function to find the target Spotify device ID.
 * It prioritizes the requested device, falls back to the first available device,
 * and handles the case where no devices are found.
 * @param spotify - The Spotify API client instance.
 * @param requestedDeviceId - The optional device ID from the request.
 * @returns A promise that resolves to the device ID string or null if no device is found.
 */
async function getSpotifyDevice(spotify: SpotifyApi, requestedDeviceId?: string): Promise<Device | null> {
  const devicesResponse = await spotify.player.getAvailableDevices();
  const availableDevices = devicesResponse.devices;

  if (requestedDeviceId) {
    const foundRequestedDevice = availableDevices.find((d) => d.id === requestedDeviceId);
    if (foundRequestedDevice && foundRequestedDevice.is_active) {
      return foundRequestedDevice;
    }
  }

  // If no requested device or it's not active, find the first active device
  const activeDevice = availableDevices.find((d) => d.is_active);
  if (activeDevice) {
    return activeDevice;
  }

  // Fallback to the first available device if no active device is found
  if (availableDevices.length > 0) {
    return availableDevices[0];
  }

  return null; // No devices available
}


export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // --- API Routes ---
  
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
      let status = await storage.getLatestMusicStatus();

      if (status?.spotifyConnected) {
        const currentTrack = await getCurrentlyPlayingTrack();
        const updateData = currentTrack
          ? {
              currentTrack: currentTrack.name,
              currentTrackArtist: currentTrack.artist,
              currentTrackAlbum: currentTrack.album,
              currentTrackImageUrl: currentTrack.imageUrl,
            }
          : {
              currentTrack: null,
              currentTrackArtist: null,
              currentTrackAlbum: null,
              currentTrackImageUrl: null,
            };
        status = await storage.updateMusicStatus(updateData);
      }

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

  // --- Spotify Routes ---

  app.get("/api/spotify/login", (req, res) => {
    res.redirect(getSpotifyAuthUrl());
  });

  app.get("/api/spotify/callback", async (req, res) => {
    const { code } = req.query;
    if (code) {
      const success = await exchangeCodeForTokens(code as string);
      if (success) {
        res.redirect("/?spotify_connected=true");
      } else {
        res.status(500).send("Failed to get Spotify tokens.");
      }
    } else {
      res.status(400).send("No authorization code received.");
    }
  });

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

  // Get user's Spotify devices
  app.get("/api/spotify/devices", async (req, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const { devices } = await spotify.player.getAvailableDevices();
      res.json(devices);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch devices", message: error.message });
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

  // Consolidated endpoint for all Spotify playback controls
  app.post("/api/spotify/player", async (req, res) => {
    const { action, deviceId, playlistId } = req.body as {
      action: 'play' | 'pause' | 'next' | 'previous';
      deviceId?: string;
      playlistId?: string;
    };

    if (!action) {
        return res.status(400).json({ error: "Player action is required" });
    }

    try {
        const spotify = await getUncachableSpotifyClient();
        const targetDevice = await getSpotifyDevice(spotify, deviceId);

        if (!targetDevice?.id) {
            return res.status(404).json({ error: "No active Spotify device found." });
        }

        switch (action) {
            case 'play':
                console.log("Playing/Resuming playback on device:", targetDevice.id, "with playlistId:", playlistId);
                if (playlistId) {
                    await spotify.player.startResumePlayback(targetDevice.id, `spotify:playlist:${playlistId}`);
                } else {
                    await spotify.player.startResumePlayback(targetDevice.id);
                }
                await storage.updateMusicStatus({ isPlaying: true });
                break;
            case 'pause':
                console.log("Pausing playback on device:", targetDevice.id);
                await spotify.player.pausePlayback(targetDevice.id);
                await storage.updateMusicStatus({ isPlaying: false });
                break;
            case 'next':
                console.log("Skipping to next track on device:", targetDevice.id);
                await spotify.player.skipToNext(targetDevice.id);
                break;
            case 'previous':
                console.log("Skipping to previous track on device:", targetDevice.id);
                await spotify.player.skipToPrevious(targetDevice.id);
                break;
            default:
                return res.status(400).json({ error: "Invalid player action." });
        }

        res.json({ success: true, message: `Action '${action}' successful on device ${targetDevice.name}.` });
    } catch (error: any) {
        console.error(`Error performing Spotify action '${action}':`, error);
        res.status(500).json({ error: `Failed to perform action: ${action}`, message: error.message || "Unknown error" });
    }
  });

  // --- Settings Routes ---

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

  // --- WebSocket Server ---

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');

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

  const broadcast = (message: any) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };

  // --- Simulation Logic ---

  // Simulate real-time sensor data updates
  setInterval(async () => {
    try {
      const settings = await storage.getSystemSettings();
      
      const newTemp = 72 + Math.random() * 6 - 3; // 69-75°F range
      const motionDetected = Math.random() < 0.05;
      const cryingDetected = Math.random() < (motionDetected ? 0.15 : 0.03);
      
      const sensorData = await storage.insertSensorData({
        temperature: newTemp,
        motionDetected,
        cryingDetected,
      });

      if (cryingDetected && settings?.autoResponse) {
        const musicStatus = await storage.getLatestMusicStatus();
        if (!musicStatus?.isPlaying) {
          if (musicStatus?.useSpotify && musicStatus?.spotifyPlaylistId) {
            try {
              const spotify = await getUncachableSpotifyClient();
              const device = await getSpotifyDevice(spotify);
              if (device?.id) {
                await spotify.player.startResumePlayback(
                  device.id,
                  `spotify:playlist:${musicStatus.spotifyPlaylistId}`
                );
                await storage.updateMusicStatus({ isPlaying: true });
              }
            } catch (error) {
              console.error('Failed to auto-play Spotify:', error);
            }
          }
        }
      }

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
  
  return httpServer;
}