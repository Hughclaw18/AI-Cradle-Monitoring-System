import * as SpotifyApiModule from "@spotify/web-api-ts-sdk";
import { URLSearchParams } from "url";
import { storage } from "./storage";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "1f7a6b45727b4d8a805a8a4fa6bee9bb";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "4abd461cb39f4a999ec5831f1d247fb6";

// Dynamic Redirect URI based on environment
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 
  (process.env.NODE_ENV === "production" 
    ? "https://smartcradlemonitor.onrender.com/api/spotify/callback"
    : "http://127.0.0.1:5000/api/spotify/callback");

export function getSpotifyAuthUrl() {
  console.log(`[Spotify] Generating Auth URL with Redirect URI: ${REDIRECT_URI}`);
  const scope = "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state user-read-currently-playing";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();
  if (response.ok) {
    console.log("Spotify Token Exchange Successful");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } else {
    console.error("Error exchanging code for tokens:", data);
    return null;
  }
}

async function refreshAccessToken(refreshToken: string) {
  console.log("Attempting to refresh Spotify access token...");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();
  if (response.ok) {
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token, // Sometimes we get a new refresh token
    };
  } else {
    console.error("Error refreshing access token:", data);
    return null;
  }
}

export async function getUncachableSpotifyClient(userId: number) {
  const config = await storage.getSpotifyConfig(userId);
  if (!config || !config.accessToken || !config.refreshToken) {
    throw new Error("Spotify not connected.");
  }

  let accessToken = config.accessToken;
  let expiresAt = config.expiresAt || 0;

  // Check if expired (buffer of 60 seconds)
  if (Date.now() / 1000 > expiresAt - 60) {
    const refreshed = await refreshAccessToken(config.refreshToken);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
      
      await storage.updateSpotifyConfig(userId, {
        accessToken: refreshed.accessToken,
        expiresAt: newExpiresAt,
        refreshToken: refreshed.refreshToken || config.refreshToken,
      });
    } else {
      console.error(`Failed to refresh token for user ${userId}. Deleting invalid config.`);
      try {
        await storage.deleteSpotifyConfig(userId);
        console.log(`Successfully deleted invalid Spotify config for user ${userId}`);
      } catch (err) {
        console.error(`Error deleting invalid Spotify config for user ${userId}:`, err);
      }
      throw new Error("Failed to refresh Spotify token");
    }
  }

  const spotify = SpotifyApiModule.SpotifyApi.withAccessToken(CLIENT_ID, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600, // Not strictly used by the SDK if we manage refresh manually
    refresh_token: config.refreshToken,
  });

  return spotify;
}

export async function getCurrentlyPlayingTrack(userId: number) {
  try {
    const spotify = await getUncachableSpotifyClient(userId);
    const currentPlayback = await spotify.player.getCurrentlyPlayingTrack();
    console.log("Spotify API - Currently Playing Track:", currentPlayback);
    if (currentPlayback && currentPlayback.item && currentPlayback.item.type === "track") {
      const track = currentPlayback.item as SpotifyApiModule.Track;
      return {
        name: track.name,
        artist: track.artists.map((artist: { name: any; }) => artist.name).join(", "),
        album: track.album.name,
        imageUrl: track.album.images[0]?.url || undefined,
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting currently playing track:", error);
    return null;
  }
}

export async function isSpotifyConnected(userId: number): Promise<boolean> {
  try {
    const config = await storage.getSpotifyConfig(userId);
    return !!(config && config.accessToken && config.refreshToken);
  } catch (error) {
    return false;
  }
}

export async function stopPlayback(userId: number, deviceId?: string) {
  try {
    const spotify = await getUncachableSpotifyClient(userId);
    const currentPlaybackState = await spotify.player.getPlaybackState();
    const activeDeviceId = currentPlaybackState?.device?.id;

    // Temporarily cast actions to any to bypass TypeScript error regarding 'disallows'
    const actions: any = currentPlaybackState?.actions;

    if (deviceId && activeDeviceId && deviceId === activeDeviceId) {
      if (actions?.disallows?.pausing) {
        console.warn("Device does not support remote pause — skipping.");
        return;
      }
    } else if (!deviceId && actions?.disallows?.pausing) {
      console.warn("Active device does not support remote pause — skipping.");
      return;
    }

    const targetDeviceId = deviceId || activeDeviceId;

    if (targetDeviceId) {
      try {
        await spotify.player.pausePlayback(targetDeviceId);
      } catch (pauseError) {
        console.error("Error during pausePlayback:", pauseError);
      }
    } else {
      console.warn("No device ID provided or active device found to pause playback.");
      return;
    }
    console.log("Stopped playback successfully.");
  } catch (error) {
    console.error("Error in stopPlayback:", error);
  }
}

export async function skipToNextTrack(userId: number, deviceId?: string) {
  try {
    const spotify = await getUncachableSpotifyClient(userId);
    const currentPlaybackState = await spotify.player.getPlaybackState();
    const activeDeviceId = currentPlaybackState?.device?.id;
    const targetDeviceId = deviceId || activeDeviceId;

    if (targetDeviceId) {
      await spotify.player.skipToNext(targetDeviceId);
      console.log("Skipped to next track successfully.");
    } else {
      console.warn("No device ID provided or active device found to skip to next track.");
    }
  } catch (error) {
    console.error("Error skipping to next track:", error);
  }
}

export async function skipToPreviousTrack(userId: number, deviceId?: string) {
  try {
    const spotify = await getUncachableSpotifyClient(userId);
    const currentPlaybackState = await spotify.player.getPlaybackState();
    const activeDeviceId = currentPlaybackState?.device?.id;
    const targetDeviceId = deviceId || activeDeviceId;

    if (targetDeviceId) {
      await spotify.player.skipToPrevious(targetDeviceId);
      console.log("Skipped to previous track successfully.");
    } else {
      console.warn("No device ID provided or active device found to skip to previous track.");
    }
  } catch (error) {
    console.error("Error skipping to previous track:", error);
  }
}

export async function startPlaylistPlayback(userId: number, deviceId?: string, playlistId?: string) {
  try {
    const spotify = await getUncachableSpotifyClient(userId);
    const currentPlaybackState = await spotify.player.getPlaybackState();
    const activeDeviceId = currentPlaybackState?.device?.id;
    const targetDeviceId = deviceId || activeDeviceId;

    if (!targetDeviceId) {
      console.warn("No device ID provided or active device found to start playback.");
      return null;
    }

    const currentContextUri = currentPlaybackState?.context?.uri;
    const playlistContextUri = playlistId ? `spotify:playlist:${playlistId}` : undefined;
    const isSameContext = !!playlistContextUri && currentContextUri === playlistContextUri;
    const isPausedOnTarget =
      currentPlaybackState?.device?.id === targetDeviceId &&
      currentPlaybackState?.is_playing === false &&
      !!currentPlaybackState?.item;

    if (isPausedOnTarget && isSameContext) {
      console.log("Resuming existing playlist playback on device:", targetDeviceId);
      await spotify.player.startResumePlayback(targetDeviceId);
    } else if (playlistId) {
      console.log("Starting playlist playback with deviceId:", targetDeviceId, "and playlistId:", playlistId);
      await spotify.player.startResumePlayback(targetDeviceId, playlistContextUri);
    } else {
      console.log("Resuming playback with deviceId:", targetDeviceId, "(no playlistId specified)");
      await spotify.player.startResumePlayback(targetDeviceId);
    }
    console.log("Started playback successfully.");
    // Add a small delay to allow Spotify API to update playback state
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    const currentTrack = await getCurrentlyPlayingTrack(userId);
    return currentTrack;
  } catch (error) {
    console.error("Error starting playback:", error);
    return null;
  }
}

export async function getSpotifyDevice(spotify: SpotifyApiModule.SpotifyApi, deviceId?: string): Promise<SpotifyApiModule.Device | undefined> {
  try {
    let devices: SpotifyApiModule.Device[] = [];
    try {
      const result = await spotify.player.getAvailableDevices();
      devices = result.devices;
    } catch (deviceError) {
      console.error("Error fetching available Spotify devices:", deviceError);
      // If fetching devices fails, we can't proceed, so return undefined
      return undefined;
    }
    console.log("Available Spotify devices:", devices);

    if (deviceId) {
      const targetDevice = devices.find(d => d.id === deviceId);
      if (targetDevice) {
        return targetDevice;
      }
    }

    // Prioritize active device
    const activeDevice = devices.find(d => d.is_active);
    if (activeDevice) {
      return activeDevice;
    }

    // Otherwise, return the first available device
    return devices[0];
  } catch (error) {
    console.error("Error in getSpotifyDevice:", error);
    return undefined;
  }
}
