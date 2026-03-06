import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertSystemSettingsSchema, insertMusicStatusSchema, insertServoStatusSchema, insertWebcamSchema, SensorData, MusicStatus } from "@shared/schema";
import { z } from "zod";
import { getSpotifyDevice, getUncachableSpotifyClient, isSpotifyConnected, getSpotifyAuthUrl, exchangeCodeForTokens, getCurrentlyPlayingTrack, skipToNextTrack, skipToPreviousTrack, startPlaylistPlayback, stopPlayback } from "./spotify";
import type { SpotifyApi, Device } from "@spotify/web-api-ts-sdk";
import { sessionMiddleware } from "./auth";
import passport from "passport";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { notifyUserBySms, getSmsConfigStatus } from "./notifications";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function registerRoutes(app: Express, httpServer: Server): Promise<Server> {
  // --- WebSocket Server Setup with Auth ---
  const wss = new WebSocketServer({ noServer: true });
  
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url !== '/socket') {
       return; 
    }

    const simulatorToken = request.headers['x-simulator-token'];
    const expectedToken = process.env.SIMULATOR_TOKEN || 'default-simulator-token';

    sessionMiddleware(request, {} as any, () => {
      passport.initialize()(request as any, {} as any, () => {
        passport.session()(request as any, {} as any, () => {
           if ((request as any).isAuthenticated()) {
             wss.handleUpgrade(request, socket, head, (ws) => {
               wss.emit('connection', ws, request);
             });
           } else if (simulatorToken === expectedToken) {
             (request as any).user = { id: 1, username: 'simulator' };
             wss.handleUpgrade(request, socket, head, (ws) => {
               wss.emit('connection', ws, request);
             });
           } else {
             socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
             socket.destroy();
           }
        });
      });
    });
  });

  // --- API Routes ---

  // --- Webcam Routes ---
  app.get("/api/webcams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const webcams = await storage.getWebcams(userId);
      res.json(webcams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch webcams" });
    }
  });

  app.post("/api/webcams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const webcamData = insertWebcamSchema.parse({ ...req.body, userId });
      const webcam = await storage.createWebcam(webcamData);
      res.status(201).json(webcam);
    } catch (error) {
       if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid webcam data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create webcam" });
      }
    }
  });

  app.delete("/api/webcams/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    try {
      await storage.deleteWebcam(userId, id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete webcam" });
    }
  });

  // Proxy RTSP stream to MJPEG
  app.get("/api/webcams/:id/stream", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    
    try {
      const webcams = await storage.getWebcams(userId);
      const webcam = webcams.find(w => w.id === id);

      if (!webcam) return res.status(404).send("Webcam not found");
      if (webcam.type !== 'rtsp') return res.status(400).send("Not an RTSP camera");

      // Set headers for MJPEG stream
      res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=ffmpeg',
        'Connection': 'keep-alive',
        'Expires': 'Fri, 01 Jan 1990 00:00:00 GMT',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache'
      });

      const command = ffmpeg(webcam.url)
        .inputOptions([
          '-rtsp_transport', 'tcp',
          '-re'
        ])
        .outputOptions([
          '-f', 'mjpeg',
          '-q:v', '5'
        ])
        .on('end', () => {
          console.log('[RTSP Proxy] Stream ended');
        })
        .on('error', (err) => {
          console.error('[RTSP Proxy] Stream error:', err.message);
          // Don't try to send response here as headers are already sent
        });

      // Pipe to response
      const stream = command.pipe();
      stream.on('data', (chunk: any) => {
        res.write(chunk);
      });
      
      req.on('close', () => {
        console.log('[RTSP Proxy] Client disconnected, killing ffmpeg');
        command.kill('SIGKILL');
      });

    } catch (error) {
      console.error('[RTSP Proxy] Setup error:', error);
      if (!res.headersSent) {
        res.sendStatus(500);
      }
    }
  });
  
  // Get latest sensor data
  app.get("/api/sensors/latest", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const data = await storage.getLatestSensorData(userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get sensor data" });
    }
  });

  // --- Notification Diagnostics & Test ---
  app.get("/api/notifications/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const user = await storage.getUser(userId);
      const settings = await storage.getSystemSettings(userId);
      const smsStatus = getSmsConfigStatus();
      res.json({
        sms: smsStatus,
        targetPhone: user?.phone ?? null,
        pushNotifications: settings?.pushNotifications ?? true,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get notification status", message: err.message });
    }
  });

  app.post("/api/notifications/test-sms", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const user = await storage.getUser(userId);
      if (!user?.phone) {
        return res.status(400).json({ error: "No phone on user profile" });
      }
      const settings = await storage.getSystemSettings(userId);
      if (settings && !settings.pushNotifications) {
        return res.status(400).json({ error: "pushNotifications disabled in settings" });
      }
      const status = getSmsConfigStatus();
      if (!status.configured) {
        return res.status(400).json({ error: "Twilio not fully configured", details: status });
      }
      await notifyUserBySms(userId, "Test SMS", "This is a Smart Cradle test message.");
      res.json({ ok: true, sentTo: user.phone });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to send test SMS", message: err.message });
    }
  });

  // Get latest servo status
  app.get("/api/servo/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const status = await storage.getLatestServoStatus(userId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get servo status" });
    }
  });

  // Update servo position
  app.post("/api/servo/position", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const { position } = req.body;
      if (typeof position !== 'number' || position < 0 || position > 180) {
        return res.status(400).json({ error: "Position must be between 0 and 180" });
      }
      const status = await storage.updateServoPosition(userId, position);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to update servo position" });
    }
  });

  // Update servo settings
  app.post("/api/servo/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const servoSettings = insertServoStatusSchema.parse({ ...req.body, userId });
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      let status = await storage.getLatestMusicStatus(userId);

      if (status?.spotifyConnected) {
        const currentTrack = await getCurrentlyPlayingTrack(userId);
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
        status = await storage.updateMusicStatus(userId, updateData);
        broadcastMusicStatus(userId, status);
      }

      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get music status" });
    }
  });

  // Update music status
  app.post("/api/music/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const musicStatus = insertMusicStatusSchema.partial().parse(req.body);
      const status = await storage.updateMusicStatus(userId, musicStatus);
      broadcastMusicStatus(userId, status);
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
    if (!req.isAuthenticated()) return res.redirect("/auth");
    res.redirect(getSpotifyAuthUrl());
  });

  app.get("/api/spotify/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const userId = (req.user as any).id;
    const { code } = req.query;
    console.log("Received Spotify callback with code:", code ? "Yes" : "No");
    if (code) {
      const success = await exchangeCodeForTokens(code as string);
      console.log("Token exchange success:", success);
      if (success) {
        // Update storage to reflect connection
        // We need to store the tokens! exchangeCodeForTokens returns them but doesn't store them.
        // Wait, exchangeCodeForTokens returns { accessToken, refreshToken, expiresIn }
        // I need to store this in spotifyConfig table.
        
        await storage.createSpotifyConfig({
            userId,
            accessToken: success.accessToken,
            refreshToken: success.refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + success.expiresIn
        });

        // Also update music status to say connected
        await storage.updateMusicStatus(userId, { spotifyConnected: true });
        const status = await storage.getLatestMusicStatus(userId);
        broadcastMusicStatus(userId, status);
        
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const connected = await isSpotifyConnected(userId);
      const musicStatus = await storage.getLatestMusicStatus(userId);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const spotify = await getUncachableSpotifyClient(userId);
      const playlists = await spotify.currentUser.playlists.playlists(50);
      res.json(playlists.items);
    } catch (error: any) {
      console.log(`[Spotify] Error fetching playlists: ${error.message}`);
      if (error.message === "Spotify not connected." || error.message === "Failed to refresh Spotify token") {
        return res.status(400).json({ error: "Spotify not connected" });
      }
      res.status(500).json({ error: "Failed to fetch playlists", message: error.message });
    }
  });

  // Get user's Spotify devices
  app.get("/api/spotify/devices", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const spotify = await getUncachableSpotifyClient(userId);
      const { devices } = await spotify.player.getAvailableDevices();
      res.json(devices);
    } catch (error: any) {
      console.log(`[Spotify] Error fetching devices: ${error.message}`);
      if (error.message === "Spotify not connected." || error.message === "Failed to refresh Spotify token") {
        return res.status(400).json({ error: "Spotify not connected" });
      }
      res.status(500).json({ error: "Failed to fetch devices", message: error.message });
    }
  });

  // Disconnect Spotify: remove stored tokens and mark status disconnected
  app.post("/api/spotify/disconnect", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      await storage.deleteSpotifyConfig(userId);
      const status = await storage.updateMusicStatus(userId, {
        spotifyConnected: false,
        currentTrack: null,
        currentTrackArtist: null,
        currentTrackAlbum: null,
        currentTrackImageUrl: null,
        isPlaying: false,
        useSpotify: false,
        spotifyPlaylistId: null,
        spotifyPlaylistName: null,
      });
      broadcastMusicStatus(userId, status);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to disconnect Spotify", message: err.message });
    }
  });

  // Set active Spotify playlist
  app.post("/api/spotify/playlist", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const { playlistId, playlistName } = req.body;
      if (!playlistId || !playlistName) {
        return res.status(400).json({ error: "Playlist ID and name are required" });
      }
      
      const musicStatus = await storage.updateMusicStatus(userId, {
        spotifyConnected: true,
        spotifyPlaylistId: playlistId,
        spotifyPlaylistName: playlistName,
        useSpotify: true,
      });

      broadcastMusicStatus(userId, musicStatus);
      
      res.json(musicStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to set playlist" });
    }
  });

  // Consolidated endpoint for all Spotify playback controls


  app.post("/api/spotify/player", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
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
      const spotify = await getUncachableSpotifyClient(userId);
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
            const currentTrackAfterPlay = await startPlaylistPlayback(userId, targetDevice.id, playlistId);
            const ensuredCurrentTrack = currentTrackAfterPlay || await getCurrentlyPlayingTrack(userId);
            const musicStatus = await storage.updateMusicStatus(userId, {
              isPlaying: true,
              currentTrack: ensuredCurrentTrack?.name || null,
              currentTrackArtist: ensuredCurrentTrack?.artist || null,
              currentTrackAlbum: ensuredCurrentTrack?.album || null,
              currentTrackImageUrl: ensuredCurrentTrack?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(userId, musicStatus);
          } catch (playError) {
            console.error("Error starting playback:", playError);
            return res.status(500).json({ error: "Failed to start playback", details: playError });
          }
          break;

        case 'pause':
          try {
            console.log("Pausing playback on device:", targetDevice.id);
            await stopPlayback(userId, targetDevice.id);
            const musicStatus = await storage.updateMusicStatus(userId, {
              isPlaying: false,
              currentTrack: null,
              currentTrackArtist: null,
              currentTrackAlbum: null,
              currentTrackImageUrl: null,
            });
            broadcastMusicStatus(userId, musicStatus);
          } catch (pauseError) {
            console.error("Error pausing playback:", pauseError);
            return res.status(500).json({ error: "Failed to pause playback", details: pauseError });
          }
          break;

        case 'next':
          try {
            console.log("Skipping to next track on device:", targetDevice.id);
            await skipToNextTrack(userId, targetDevice.id);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentTrackAfterNext = await getCurrentlyPlayingTrack(userId);
            const musicStatus = await storage.updateMusicStatus(userId, {
              isPlaying: true,
              currentTrack: currentTrackAfterNext?.name || null,
              currentTrackArtist: currentTrackAfterNext?.artist || null,
              currentTrackAlbum: currentTrackAfterNext?.album || null,
              currentTrackImageUrl: currentTrackAfterNext?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(userId, musicStatus);
          } catch (nextError) {
            console.error("Error skipping to next track:", nextError);
            return res.status(500).json({ error: "Failed to skip to next track", details: nextError });
          }
          break;

        case 'previous':
          try {
            console.log("Skipping to previous track on device:", targetDevice.id);
            await skipToPreviousTrack(userId, targetDevice.id);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentTrackAfterPrevious = await getCurrentlyPlayingTrack(userId);
            const musicStatus = await storage.updateMusicStatus(userId, {
              isPlaying: true,
              currentTrack: currentTrackAfterPrevious?.name || null,
              currentTrackArtist: currentTrackAfterPrevious?.artist || null,
              currentTrackAlbum: currentTrackAfterPrevious?.album || null,
              currentTrackImageUrl: currentTrackAfterPrevious?.imageUrl || null,
              spotifyConnected: true,
            });
            broadcastMusicStatus(userId, musicStatus);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const settings = await storage.getSystemSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  // Update system settings
  app.post("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const settings = insertSystemSettingsSchema.partial().parse(req.body);
      const updatedSettings = await storage.updateSystemSettings(userId, settings);
      
      broadcast(userId, {
        type: 'settings_update',
        data: updatedSettings
      });

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

  // Map userId to Set of WebSockets
  const clients = new Map<number, Set<WebSocket>>();
  
  // Track user-specific state for alerts and automation
  interface UserState {
    lastCryingAlertTime: number;
    lastObjectAlertTime: number;
    lastTempAlertTime: number;
    lastCombinedSmsTime: number;
    cryingPlaybackActive: boolean;
    cryingPlaybackTimeout: NodeJS.Timeout | null;
  }
  const userStates = new Map<number, UserState>();

  function getUserState(userId: number): UserState {
    if (!userStates.has(userId)) {
      userStates.set(userId, {
        lastCryingAlertTime: 0,
        lastObjectAlertTime: 0,
        lastTempAlertTime: 0,
        lastCombinedSmsTime: 0,
        cryingPlaybackActive: false,
        cryingPlaybackTimeout: null,
      });
    }
    return userStates.get(userId)!;
  }

  wss.on('connection', (ws: WebSocket & { isAlive?: boolean }, req: any) => {
    // req.user should be populated by the session middleware in the upgrade handler
    if (!req.user) {
        ws.close();
        return;
    }
    const userId = (req.user as any).id;
    
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);
    
    console.log(`Client connected to WebSocket (User ID: ${userId})`);

    const sendInitialData = async () => {
      try {
        let sensorData = await storage.getLatestSensorData(userId);
        if (sensorData && typeof (sensorData as any).objectDetected === 'string') {
          try {
            (sensorData as any).objectDetected = JSON.parse((sensorData as any).objectDetected);
          } catch {
            (sensorData as any).objectDetected = [];
          }
        }
        const musicStatus = await storage.getLatestMusicStatus(userId);
        const settings = await storage.getSystemSettings(userId);

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
          console.log(`[WS] sensor_update received for user ${userId}`);
          const sensorData = parsedMessage.data;
          
          // Optimization: Broadcast immediately to reduce latency
          broadcast(userId, {
            type: 'sensor_update',
            data: sensorData
          });

          // Ensure sensor data is associated with the user for DB storage
          const toInsert: any = { ...sensorData, userId };
          if (toInsert.timestamp !== undefined) delete toInsert.timestamp;
          if (toInsert.id !== undefined) delete toInsert.id;
          
          const toStore: any = { ...toInsert };
          if (toStore.objectDetected !== undefined && toStore.objectDetected !== null) {
            if (typeof toStore.objectDetected === 'string') {
              toStore.objectDetected = JSON.stringify([{ object_name: toStore.objectDetected, timestamp: new Date().toISOString() }]);
            } else if (Array.isArray(toStore.objectDetected)) {
              toStore.objectDetected = JSON.stringify(toStore.objectDetected);
            } else {
              toStore.objectDetected = null;
            }
          }

          // Optimization: DB insert in background to avoid blocking alerts/broadcasts
          storage.insertSensorData(toStore).catch(err => {
            console.error('[Storage] Background sensor insert failed:', err.message);
          });

          const state = getUserState(userId);
          const currentTime = Date.now();
          const settings = await storage.getSystemSettings(userId);

          // Check for alerts
        const smsParts: string[] = [];
          if (settings && sensorData.temperature > (settings.tempThreshold || 78) && (currentTime - state.lastTempAlertTime > 60 * 1000)) {
            const notif = {
              title: 'High Temperature Alert!',
              message: `Temperature is ${sensorData.temperature}°F`,
              severity: 'warning' as const
            };
            broadcast(userId, { type: 'notification', data: notif });
          smsParts.push(`High temperature ${sensorData.temperature}°F`);
            state.lastTempAlertTime = currentTime;
          }

          if (settings && sensorData.objectDetected && sensorData.objectDetected.length > 0 && (currentTime - state.lastObjectAlertTime > 30 * 1000)) {
            const notif = {
              title: 'Object Detected!',
              message: 'An object has been detected in the crib.',
              severity: 'info' as const
            };
            broadcast(userId, { type: 'notification', data: notif });
          smsParts.push('Object detected in the crib');
            state.lastObjectAlertTime = currentTime;
          }

          if (settings && sensorData.cryingDetected && (currentTime - state.lastCryingAlertTime > 30 * 1000)) {
            const notif = {
              title: 'Crying Detected!',
              message: 'Baby is crying!',
              severity: 'warning' as const
            };
            broadcast(userId, { type: 'notification', data: notif });
          smsParts.push('Crying detected');
            state.lastCryingAlertTime = currentTime;
          }

        // Send a single combined SMS if any alerts occurred
        if (settings?.pushNotifications && smsParts.length > 0) {
          const COMBINED_SMS_COOLDOWN_MS = 30 * 1000;
          if (currentTime - state.lastCombinedSmsTime > COMBINED_SMS_COOLDOWN_MS) {
            const combined = smsParts.join('; ');
            notifyUserBySms(userId, 'Smart Cradle Alerts', combined);
            state.lastCombinedSmsTime = currentTime;
          }
        }

          // Auto-rocking based on crying
          if (sensorData.cryingDetected && settings?.autoResponse) {
            if (state.cryingPlaybackTimeout) {
              clearTimeout(state.cryingPlaybackTimeout);
              state.cryingPlaybackTimeout = null;
            }

            if (!state.cryingPlaybackActive) {
              const musicStatus = await storage.getLatestMusicStatus(userId);
              if (!musicStatus?.isPlaying) {
                if (musicStatus?.useSpotify && musicStatus?.spotifyPlaylistId) {
                  try {
                    const spotify = await getUncachableSpotifyClient(userId);
                    const device = await getSpotifyDevice(spotify);
                    if (device?.id) {
                      const currentTrackAfterCryingPlay = await startPlaylistPlayback(userId, device.id, musicStatus.spotifyPlaylistId);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      const updatedStatus = await storage.updateMusicStatus(userId, {
                        isPlaying: true,
                        currentTrack: currentTrackAfterCryingPlay?.name || null,
                        currentTrackArtist: currentTrackAfterCryingPlay?.artist || null,
                        currentTrackAlbum: currentTrackAfterCryingPlay?.album || null,
                        currentTrackImageUrl: currentTrackAfterCryingPlay?.imageUrl || null,
                      });
                      broadcastMusicStatus(userId, updatedStatus);
                      state.cryingPlaybackActive = true;
                    }
                  } catch (error) {
                    console.error('Failed to auto-play Spotify:', error);
                  }
                }
              }
            }
          } else if (state.cryingPlaybackActive && !sensorData.cryingDetected) {
            if (!state.cryingPlaybackTimeout) {
              state.cryingPlaybackTimeout = setTimeout(async () => {
                console.log('Crying playback timeout reached, pausing music.');
                const musicStatus = await storage.getLatestMusicStatus(userId);
                if (musicStatus?.isPlaying) {
                  try {
                    const spotify = await getUncachableSpotifyClient(userId);
                    const device = await getSpotifyDevice(spotify);
                    if (device?.id) {
                      await stopPlayback(userId, device.id);
                      const updatedStatus = await storage.updateMusicStatus(userId, {
                        isPlaying: false,
                        currentTrack: null,
                        currentTrackArtist: null,
                        currentTrackAlbum: null,
                        currentTrackImageUrl: null,
                      });
                      broadcastMusicStatus(userId, updatedStatus);
                    }
                  } catch (error) {
                    console.error('Failed to stop Spotify playback:', error);
                  }
                }
                state.cryingPlaybackActive = false;
                state.cryingPlaybackTimeout = null;
              }, 30000);
            }
          } else if (!sensorData.cryingDetected && state.cryingPlaybackTimeout) {
            clearTimeout(state.cryingPlaybackTimeout);
            state.cryingPlaybackTimeout = null;
          }
        } else if (parsedMessage.type === 'video_frame') {
          console.log(`[WS] video_frame received for user ${userId}`);
          // Relay video frame to other clients
          broadcast(userId, {
            type: 'video_frame',
            data: parsedMessage.data
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          clients.delete(userId);
          // Optimization: Clean up user state when no clients are connected
          userStates.delete(userId);
          console.log(`[WS] User state cleaned up for User ID: ${userId}`);
        }
      }
      const reasonText = (() => {
        try {
          return reason?.toString() || '';
        } catch {
          return '';
        }
      })();
      console.log(`Client disconnected from WebSocket (User ID: ${userId}) code=${code} reason="${reasonText}"`);
    });

    ws.on('error', (error) => {
      console.error(`[WS] error for user ${userId}:`, error);
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
      }
    });
  });

  function broadcast(userId: number, message: any) {
    const userClients = clients.get(userId);
    if (userClients) {
        userClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
  }

  function broadcastMusicStatus(userId: number, status: MusicStatus | null | undefined) {
    if (!status) return;
    broadcast(userId, {
      type: 'music_update',
      data: status,
    });
  }

  // --- Simulation Logic ---

  // Map userId to last error time for simulation to avoid log spam
  const lastSimErrorTime = new Map<number, number>();

  // Simulate servo position updates for auto-rock
  setInterval(async () => {
    // Iterate over all connected users (or active users)
    for (const userId of Array.from(clients.keys())) {
        try {
          const servoStatus = await storage.getLatestServoStatus(userId);
          if (servoStatus?.autoRock) {
            const time = Date.now() / 1000;
            const newPosition = Math.round(45 + 15 * Math.sin(time * 0.5)); // 30-60 degree range
            
            const updatedStatus = await storage.insertServoStatus({
              userId,
              position: newPosition,
              isMoving: true,
              autoRock: true,
            });
    
            broadcast(userId, {
              type: 'servo_update',
              data: updatedStatus
            });
          }
        } catch (error) {
          const now = Date.now();
          const lastError = lastSimErrorTime.get(userId) || 0;
          if (now - lastError > 300000) { // Only log every 5 minutes
            console.error(`Error in servo simulation (User: ${userId}):`, (error as Error).message);
            lastSimErrorTime.set(userId, now);
          }
        }
    }
  }, 1000);
  // Cleanup dead WebSocket connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        console.log('[WS] Connection dead, terminating');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 50000); // Increased interval for slower simulator analysis

  wss.on('close', () => {
    clearInterval(interval);
  });

  return httpServer;
}
