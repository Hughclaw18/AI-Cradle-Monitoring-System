import { Play, Pause, Music2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MusicStatus } from "@shared/schema";

interface SpotifyPlayerProps {
  musicStatus?: MusicStatus;
}

export function SpotifyPlayer({ musicStatus }: SpotifyPlayerProps) {
  const { toast } = useToast();

  const playMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/spotify/play", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/status"] });
      toast({
        title: "Playing",
        description: "Spotify playback started",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Playback Error",
        description: error.message || "Failed to play from Spotify. Make sure Spotify is open on a device.",
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/spotify/pause", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/status"] });
      toast({
        title: "Paused",
        description: "Spotify playback paused",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to pause Spotify",
        variant: "destructive",
      });
    },
  });

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

        {/* Playback Controls */}
        <div className="flex justify-center">
          <Button
            data-testid="button-spotify-play-pause"
            onClick={handlePlayPause}
            disabled={isLoading || !musicStatus?.spotifyPlaylistId}
            size="lg"
            className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400"
          >
            {isLoading ? (
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
            ) : musicStatus?.isPlaying ? (
              <Pause className="h-8 w-8 text-white" />
            ) : (
              <Play className="h-8 w-8 text-white ml-1" />
            )}
          </Button>
        </div>

        {/* Instructions */}
        {musicStatus?.useSpotify && (
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>Make sure Spotify is open on a device to play music</p>
            <p className="text-green-600 dark:text-green-400 font-medium">
              Music will play automatically when baby cries
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
