import { Play, Pause, Music2, SkipBack, SkipForward } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/queryClient";
import { MusicStatus } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "../hooks/use-toast";
import * as SpotifyApiModule from "@spotify/web-api-ts-sdk";

// Define the component's props
interface SpotifyPlayerProps {
  // musicStatus can be undefined, so we make it optional
  musicStatus?: MusicStatus;
}

export function SpotifyPlayer({ musicStatus }: SpotifyPlayerProps) {
  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  console.log("Music Status in SpotifyPlayer:", musicStatus);
  // Fetch available Spotify devices
  interface UserDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

const { data: devices } = useQuery<UserDevice[]>({
    queryKey: ["spotifyDevices"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/spotify/devices");
      if (!response.ok) {
        throw new Error("Failed to fetch Spotify devices");
      }
      return response.json();
    },
  });

  // Mutation to play music
  const playMutation = useMutation({
    mutationFn: () => {
      console.log("Sending play request with deviceId:", selectedDeviceId);
      return apiRequest("POST", "/api/spotify/player/play", { deviceId: selectedDeviceId });
    },
    onSuccess: () => {
      toast({
        title: "Spotify Playback",
        description: "Playing Spotify music.",
      });
      queryClient.invalidateQueries({ queryKey: ["musicStatus"] });
    },
    onError: (error) => {
      console.error("Failed to play Spotify playback:", error);
      toast({
        title: "Spotify Playback Failed",
        description: `Failed to play Spotify playback: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to pause music
  const pauseMutation = useMutation({
    mutationFn: () => {
      console.log("Sending pause request with deviceId:", selectedDeviceId);
      return apiRequest("POST", "/api/spotify/player/pause", { deviceId: selectedDeviceId });
    },
    onSuccess: () => {
      toast({
        title: "Spotify Playback",
        description: "Paused Spotify music.",
      });
      queryClient.invalidateQueries({ queryKey: ["musicStatus"] });
    },
    onError: (error) => {
      console.error("Failed to pause Spotify playback:", error);
      toast({
        title: "Spotify Playback Failed",
        description: `Failed to pause Spotify playback: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to skip to the next track
  const nextMutation = useMutation({
    mutationFn: () => {
      console.log("Sending next request with deviceId:", selectedDeviceId);
      return apiRequest("POST", "/api/spotify/player/next", {
      action: "next",
      deviceId: selectedDeviceId,
    });
    },
    onSuccess: () => {
      toast({
        title: "Spotify Playback",
        description: "Skipped to next track.",
      });
      queryClient.invalidateQueries({ queryKey: ["musicStatus"] });
    },
    onError: (error) => {
      console.error("Failed to skip to next track:", error);
      toast({
        title: "Spotify Playback Failed",
        description: `Failed to skip to next track: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to go to the previous track
  const previousMutation = useMutation({
    mutationFn: () => {
      console.log("Sending previous request with deviceId:", selectedDeviceId);
      return apiRequest("POST", "/api/spotify/player/previous", {
      action: "previous",
      deviceId: selectedDeviceId,
    });
    },
    onSuccess: () => {
      toast({
        title: "Spotify Playback",
        description: "Skipped to previous track.",
      });
      queryClient.invalidateQueries({ queryKey: ["musicStatus"] });
    },
    onError: (error) => {
      console.error("Failed to skip to previous track:", error);
      toast({
        title: "Spotify Playback Failed",
        description: `Failed to skip to previous track: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handler for the play/pause button
  const handlePlayPause = () => {
    if (!musicStatus?.spotifyPlaylistId) {
      toast({
        title: "No playlist selected",
        description: "Please select a playlist first",
        variant: "destructive",
      });
      return;
    }

    if (musicStatus?.isPlaying) {
      pauseMutation.mutate();
    } else {
      playMutation.mutate();
    }
  };

  // Effect to automatically select the first available device
  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const isLoading = playMutation.isPending || pauseMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-green-500" />
          Spotify Player
        </CardTitle>
        <CardDescription>
          {musicStatus?.useSpotify && musicStatus?.spotifyConnected
            ? "Music will play from Spotify when baby cries"
            : "Configure Spotify to enable playback"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant={musicStatus?.spotifyConnected ? "default" : "secondary"}
            className={musicStatus?.spotifyConnected ? "bg-green-500" : ""}
          >
            {musicStatus?.spotifyConnected ? "Connected" : "Not Connected"}
          </Badge>
          {musicStatus?.isPlaying && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              Playing
            </Badge>
          )}
        </div>

        {/* Current Playlist */}
        {musicStatus?.spotifyPlaylistName ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Music2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Active Playlist</p>
                <p className="text-green-600 dark:text-green-400 font-semibold">
                  {musicStatus.spotifyPlaylistName}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No playlist selected. Choose one from the settings below.
            </p>
          </div>
        )}

        {/* Current Track Details */}
        <div className="flex items-center space-x-4">
          {musicStatus?.currentTrackImageUrl && (
            <img
              src={musicStatus.currentTrackImageUrl}
              alt="Album Art"
              className="h-16 w-16 rounded-md object-cover"
            />
          )}
          <div>
            <CardTitle className="text-lg">
              {musicStatus?.currentTrack || "No track playing"}
            </CardTitle>
            <CardDescription>
              {musicStatus?.currentTrackArtist && musicStatus?.currentTrackAlbum
                ? `${musicStatus.currentTrackArtist} - ${musicStatus.currentTrackAlbum}`
                : musicStatus?.currentTrackArtist || musicStatus?.currentTrackAlbum || ""}
            </CardDescription>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex justify-center items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => previousMutation.mutate()}
            disabled={!musicStatus?.spotifyPlaylistId}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            data-testid="button-spotify-play-pause"
            onClick={handlePlayPause}
            disabled={isLoading || !musicStatus?.spotifyPlaylistId}
            size="lg"
            className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 mx-2"
          >
            {isLoading ? (
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
            ) : musicStatus?.isPlaying ? (
              <Pause className="h-8 w-8 text-white" />
            ) : (
              <Play className="h-8 w-8 text-white ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nextMutation.mutate()}
            disabled={!musicStatus?.spotifyPlaylistId}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Device Selection */}
        {/* FIX: Used optional chaining `?.` to prevent crash if musicStatus is undefined */}
        {musicStatus?.spotifyConnected && devices && devices.length > 0 && (
          <div className="flex flex-col items-center space-y-2 pt-4">
            <label className="text-sm font-medium text-muted-foreground">Playback Device</label>
            <Select onValueChange={setSelectedDeviceId} value={selectedDeviceId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device: UserDevice) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} ({device.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Instructions */}
        {musicStatus?.useSpotify && (
          <div className="text-xs text-muted-foreground text-center space-y-1 pt-2">
            <p>Make sure Spotify is open on a device to play music.</p>
            <p className="text-green-600 dark:text-green-400 font-medium">
              Music will play automatically when the baby cries.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}