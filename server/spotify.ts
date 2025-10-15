import * as SpotifyApiModule from "@spotify/web-api-ts-sdk";
import { URLSearchParams } from "url";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "69bf2fb863af44c1b890327fb1f1efec";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "58c63fd24c884237a3d510cfc9bd6fc0";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/api/spotify/callback";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresIn: number = 0;
let tokenTimestamp: number = 0;

export function getSpotifyAuthUrl() {
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
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    expiresIn = data.expires_in;
    tokenTimestamp = Date.now();
    return true;
  } else {
    console.error("Error exchanging code for tokens:", data);
    return false;
  }
}

async function refreshAccessToken() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken || "",
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
    accessToken = data.access_token;
    expiresIn = data.expires_in;
    tokenTimestamp = Date.now();
    return true;
  } else {
    console.error("Error refreshing access token:", data);
    return false;
  }
}

async function getAccessToken() {
  if (!accessToken || (Date.now() - tokenTimestamp) / 1000 >= expiresIn) {
    if (refreshToken) {
      await refreshAccessToken();
    } else {
      throw new Error("No access token or refresh token available. Please connect to Spotify.");
    }
  }
  return accessToken;
}

export async function getUncachableSpotifyClient() {
  const currentAccessToken = await getAccessToken();
  if (!currentAccessToken) {
    throw new Error("Spotify not connected.");
  }

  const spotify = SpotifyApiModule.SpotifyApi.withAccessToken(CLIENT_ID, {
    access_token: currentAccessToken as string,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken || "",
  });

  return spotify;
}

export async function getCurrentlyPlayingTrack() {
  const spotify = await getUncachableSpotifyClient();
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
}

export async function isSpotifyConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch (error) {
    return false;
  }
}
