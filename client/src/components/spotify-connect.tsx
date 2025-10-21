import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Music2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SpotifyStatus {
  connected: boolean;
  playlistId: string | null;
  playlistName: string | null;
  useSpotify: boolean;
}

interface Playlist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  tracks: { total: number };
}

export function SpotifyConnect() {
  const { toast } = useToast();
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<SpotifyStatus>({
    queryKey: ["/api/spotify/status"],
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/spotify/playlists"],
    enabled: status?.connected === true,
  });

  const setPlaylistMutation = useMutation({
    mutationFn: async (playlist: Playlist) => {
      console.log("Attempting to set playlist:", playlist);
      return apiRequest("POST", "/api/spotify/playlist", {
        playlistId: playlist.id,
        playlistName: playlist.name,
      });
    },
    onSuccess: () => {
      console.log("Playlist set successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/status"] });
      toast({
        title: "Playlist set",
        description: "Your Spotify playlist has been connected successfully",
      });
    },
    onError: (error) => {
      console.error("Failed to set playlist:", error);
      toast({
        title: "Error",
        description: "Failed to set playlist",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (status?.playlistId) {
      setSelectedPlaylist(status.playlistId);
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("spotify_connected") === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/status"] });
      // Clean up the URL
      urlParams.delete("spotify_connected");
      window.history.replaceState({}, document.title, `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`);
    }
  }, [status]);

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-green-500" />
            Connect to Spotify
          </CardTitle>
          <CardDescription>
            Connect your Spotify account to enable music playback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = "/api/spotify/login"}>
            Connect to Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-green-500" />
          Select Playlist
        </CardTitle>
        <CardDescription>
          Choose a playlist to play when the baby cries
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.playlistName && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Active: {status.playlistName}
            </p>
          </div>
        )}

        {playlistsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {playlists?.map((playlist) => (
                <button
                  key={playlist.id}
                  data-testid={`playlist-${playlist.id}`}
                  onClick={() => {
                    console.log("Selected playlist:", playlist);
                    setSelectedPlaylist(playlist.id);
                    setPlaylistMutation.mutate(playlist);
                  }}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedPlaylist === playlist.id
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-green-500/50 hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {playlist.images?.[0]?.url ? (
                      <img
                        src={playlist.images[0].url}
                        alt={playlist.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <Music2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{playlist.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {playlist.tracks.total} tracks
                      </p>
                    </div>
                    {selectedPlaylist === playlist.id && (
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {playlists && playlists.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No playlists found. Create a playlist in Spotify first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
