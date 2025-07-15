import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Track } from "@shared/schema";
import { useAudio } from "@/hooks/use-audio";

interface MusicPlayerProps {
  tracks: Track[];
  currentTrack?: string;
  isPlaying?: boolean;
  volume?: number;
  progress?: number;
  onPlayPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  onTrackSelect?: (track: Track) => void;
}

export function MusicPlayer({ 
  tracks, 
  currentTrack, 
  isPlaying = false, 
  volume = 65,
  progress = 0,
  onPlayPause,
  onVolumeChange,
  onTrackSelect
}: MusicPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const { formatTime } = useAudio();

  const selectedTrack = tracks.find(t => t.name === currentTrack) || tracks[0];

  useEffect(() => {
    if (currentTrack) {
      const index = tracks.findIndex(t => t.name === currentTrack);
      if (index !== -1) {
        setCurrentTrackIndex(index);
      }
    }
  }, [currentTrack, tracks]);

  const handlePrevious = () => {
    const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
    setCurrentTrackIndex(prevIndex);
    onTrackSelect?.(tracks[prevIndex]);
  };

  const handleNext = () => {
    const nextIndex = currentTrackIndex < tracks.length - 1 ? currentTrackIndex + 1 : 0;
    setCurrentTrackIndex(nextIndex);
    onTrackSelect?.(tracks[nextIndex]);
  };

  const handleVolumeChange = (value: number[]) => {
    onVolumeChange?.(value[0]);
  };

  return (
    <div className="space-y-4">
      {/* Now Playing */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center mb-4">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mx-auto mb-3 flex items-center justify-center">
              <Volume2 className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 text-lg">
              {selectedTrack?.name || 'No Track Selected'}
            </h3>
            <p className="text-gray-500 text-sm">{selectedTrack?.artist || 'Unknown Artist'}</p>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime((selectedTrack?.duration || 0) * progress)}</span>
              <span>{formatTime(selectedTrack?.duration || 0)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center space-x-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              className="w-12 h-12 rounded-full"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-indigo-500 hover:bg-indigo-600"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-white" />
              ) : (
                <Play className="h-6 w-6 text-white" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="w-12 h-12 rounded-full"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Volume Control */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">Volume</h3>
            <span className="text-sm text-gray-500">{volume}%</span>
          </div>
          <div className="flex items-center space-x-3">
            <VolumeX className="h-4 w-4 text-gray-400" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <Volume2 className="h-4 w-4 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Track List */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-800 mb-3">Available Lullabies</h3>
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => onTrackSelect?.(track)}
                className={cn(
                  "flex items-center p-3 rounded-lg cursor-pointer transition-colors",
                  selectedTrack?.id === track.id ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50"
                )}
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <Volume2 className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{track.name}</div>
                  <div className="text-sm text-gray-500">{formatTime(track.duration)}</div>
                </div>
                <div className="text-gray-400">
                  {selectedTrack?.id === track.id && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
