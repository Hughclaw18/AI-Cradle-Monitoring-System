import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertSystemSettingsSchema, insertMusicStatusSchema, insertServoStatusSchema, SensorData, MusicStatus } from "@shared/schema";
import { z } from "zod";
import { getSpotifyDevice, getUncachableSpotifyClient, isSpotifyConnected, getSpotifyAuthUrl, exchangeCodeForTokens, getCurrentlyPlayingTrack, skipToNextTrack, skipToPreviousTrack, startPlaylistPlayback, stopPlayback } from "./spotify";
import type { SpotifyApi, Device } from "@spotify/web-api-ts-sdk";

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
              isPlaying: true,
              spotifyConnected: true,
            }
          : {
              currentTrack: null,
              currentTrackArtist: null,
              currentTrackAlbum: null,
              currentTrackImageUrl: null,
              isPlaying: false,
              spotifyConnected: true,
            };
        status = await storage.updateMusicStatus(updateData);
        console.log("Broadcasting music status update:", status);
        broadcastMusicStatus(status);
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
      broadcastMusicStatus(status);
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

      broadcastMusicStatus(musicStatus);
      
      res.json(musicStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to set playlist" });
    }
  });

  // Consolidated endpoint for all Spotify playback controls


  app.post("/api/spotify/player", async (req, res) => {
    console.log("Received /api/spotify/player request. Body:", req.body);
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

      // Transfer playback to target device before any playback action
      try {
        await spotify.player.transferPlayback([targetDevice.id], false);
        console.log(`Playback transferred to device: ${targetDevice.id}`);
      } catch (transferError) {
        console.error("Error transferring playback:", transferError);
        return res.status(500).json({ error: "Failed to transfer playback", details: transferError });
      }

      switch (action) {
        case 'play':
          try {
            console.log("Starting playback on device:", targetDevice.id, "with playlistId:", playlistId);
            const currentTrackAfterPlay = await startPlaylistPlayback(targetDevice.id, playlistId);
            const ensuredCurrentTrack = currentTrackAfterPlay || await getCurrentlyPlayingTrack();
            const musicStatus = await storage.updateMusicStatus({
              isPlaying: true,
              currentTrack: ensuredCurrentTrack?.name || null,
              currentTrackArtist: ensuredCurrentTrack?.artist || null,
              currentTrackAlbum: ensuredCurrentTrack?.album || null,
              currentTrackImageUrl: ensuredCurrentTrack?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(musicStatus);
          } catch (playError) {
            console.error("Error starting playback:", playError);
            return res.status(500).json({ error: "Failed to start playback", details: playError });
          }
          break;

        case 'pause':
          try {
            console.log("Pausing playback on device:", targetDevice.id);
            await stopPlayback(targetDevice.id);
            const musicStatus = await storage.updateMusicStatus({
              isPlaying: false,
              currentTrack: null,
              currentTrackArtist: null,
              currentTrackAlbum: null,
              currentTrackImageUrl: null,
            });
            broadcastMusicStatus(musicStatus);
          } catch (pauseError) {
            console.error("Error pausing playback:", pauseError);
            return res.status(500).json({ error: "Failed to pause playback", details: pauseError });
          }
          break;

        case 'next':
          try {
            console.log("Skipping to next track on device:", targetDevice.id);
            await skipToNextTrack(targetDevice.id);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentTrackAfterNext = await getCurrentlyPlayingTrack();
            const musicStatus = await storage.updateMusicStatus({
              isPlaying: true,
              currentTrack: currentTrackAfterNext?.name || null,
              currentTrackArtist: currentTrackAfterNext?.artist || null,
              currentTrackAlbum: currentTrackAfterNext?.album || null,
              currentTrackImageUrl: currentTrackAfterNext?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(musicStatus);
          } catch (nextError) {
            console.error("Error skipping to next track:", nextError);
            return res.status(500).json({ error: "Failed to skip to next track", details: nextError });
          }
          break;

        case 'previous':
          try {
            console.log("Skipping to previous track on device:", targetDevice.id);
            await skipToPreviousTrack(targetDevice.id);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentTrackAfterPrevious = await getCurrentlyPlayingTrack();
            const musicStatus = await storage.updateMusicStatus({
              isPlaying: true,
              currentTrack: currentTrackAfterPrevious?.name || null,
              currentTrackArtist: currentTrackAfterPrevious?.artist || null,
              currentTrackAlbum: currentTrackAfterPrevious?.album || null,
              currentTrackImageUrl: currentTrackAfterPrevious?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(musicStatus);
          } catch (prevError) {
            console.error("Error skipping to previous track:", prevError);
            return res.status(500).json({ error: "Failed to skip to previous track", details: prevError });
          }
          break;

        default:
          return res.status(400).json({ error: "Invalid player action." });
      }

      res.json({ success: true, message: `Action '${action}' successful on device ${targetDevice.name}.` });
    } catch (error: any) {
      console.error(`Error performing Spotify action '${req.body.action}':`, error);
      res.status(500).json({ error: `Failed to perform action: ${req.body.action}`, message: error.message || "Unknown error" });
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
        const musicStatus = await storage.getLatestMusicStatus();
        const settings = await storage.getSystemSettings();

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'initial_data',
            data: {
              sensors: sensorData,
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

    ws.on('message', async (message: string) => {
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'sensor_update') {
          const sensorData = parsedMessage.data;
          await storage.insertSensorData(sensorData);
          broadcast({
            type: 'sensor_update',
            data: sensorData
          });

          // Check for alerts
          const currentTime = Date.now();
          const settings = await storage.getSystemSettings();

          if (settings && sensorData.temperature > (settings.tempThreshold || 78) && (currentTime - lastTempAlertTime > 60 * 1000)) { // 1 minute delay
            broadcast({
              type: 'notification',
              data: {
                title: 'High Temperature Alert!',
                message: `Temperature is ${sensorData.temperature}°F`,
                severity: 'warning'
              }
            });
            lastTempAlertTime = currentTime;
          }

          if (settings && sensorData.objectDetected && sensorData.objectDetected.length > 0 && (currentTime - lastObjectAlertTime > 30 * 1000)) { // 30 seconds delay
            broadcast({
              type: 'notification',
              data: {
                title: 'Object Detected!',
                message: 'An object has been detected in the crib.',
                severity: 'info'
              }
            });
            lastObjectAlertTime = currentTime;
          }

          if (settings && sensorData.cryingDetected && (currentTime - lastCryingAlertTime > 30 * 1000)) {
            broadcast({
              type: 'notification',
              data: {
                title: 'Crying Detected!',
                message: 'Baby is crying!',
                severity: 'warning'
              }
            });
            lastCryingAlertTime = currentTime;
          }

          // Auto-rocking based on crying
          if (sensorData.cryingDetected && settings?.autoResponse) {
            if (cryingPlaybackTimeout) {
              clearTimeout(cryingPlaybackTimeout);
              cryingPlaybackTimeout = null;
            }

            if (!cryingPlaybackActive) {
              const musicStatus = await storage.getLatestMusicStatus();
              if (!musicStatus?.isPlaying) {
                if (musicStatus?.useSpotify && musicStatus?.spotifyPlaylistId) {
                  try {
                    const spotify = await getUncachableSpotifyClient();
                    const device = await getSpotifyDevice(spotify);
                    if (device?.id) {
                      const currentTrackAfterCryingPlay = await startPlaylistPlayback(device.id, musicStatus.spotifyPlaylistId);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      const updatedStatus = await storage.updateMusicStatus({
                        isPlaying: true,
                        currentTrack: currentTrackAfterCryingPlay?.name || null,
                        currentTrackArtist: currentTrackAfterCryingPlay?.artist || null,
                        currentTrackAlbum: currentTrackAfterCryingPlay?.album || null,
                        currentTrackImageUrl: currentTrackAfterCryingPlay?.imageUrl || null,
                      });
                      broadcastMusicStatus(updatedStatus);
                      cryingPlaybackActive = true;
                    }
                  } catch (error) {
                    console.error('Failed to auto-play Spotify:', error);
                  }
                }
              }
            }
          } else if (cryingPlaybackActive && !sensorData.cryingDetected) {
            if (!cryingPlaybackTimeout) {
              cryingPlaybackTimeout = setTimeout(async () => {
                console.log('Crying playback timeout reached, pausing music.');
                const musicStatus = await storage.getLatestMusicStatus();
                if (musicStatus?.isPlaying) {
                  try {
                    const spotify = await getUncachableSpotifyClient();
                    const device = await getSpotifyDevice(spotify);
                    if (device?.id) {
                      await stopPlayback(device.id);
                      const updatedStatus = await storage.updateMusicStatus({
                        isPlaying: false,
                        currentTrack: null,
                        currentTrackArtist: null,
                        currentTrackAlbum: null,
                        currentTrackImageUrl: null,
                      });
                      broadcastMusicStatus(updatedStatus);
                    }
                  } catch (error) {
                    console.error('Failed to stop Spotify playback:', error);
                  }
                }
                cryingPlaybackActive = false;
                cryingPlaybackTimeout = null;
              }, 30000);
            }
          } else if (!sensorData.cryingDetected && cryingPlaybackTimeout) {
            clearTimeout(cryingPlaybackTimeout);
            cryingPlaybackTimeout = null;
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });

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

  const broadcastMusicStatus = (status: MusicStatus | null | undefined) => {
    if (!status) return;
    broadcast({
      type: 'music_update',
      data: status,
    });
  };

  // --- Simulation Logic ---

  let lastCryingAlertTime = 0;
  let lastObjectAlertTime = 0;
  let lastTempAlertTime = 0;
  let lastCryingState = false;
  let cryingPlaybackActive = false; // New flag
  let cryingPlaybackTimeout: NodeJS.Timeout | null = null; // New timeout variable



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
