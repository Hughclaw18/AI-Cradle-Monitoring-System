import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Webcam, SystemSettings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoOff } from "lucide-react";

interface VideoFeedProps {
  settings?: SystemSettings;
}

export function VideoFeed({ settings }: VideoFeedProps) {
  const [selectedWebcamId, setSelectedWebcamId] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const { data: webcams } = useQuery<Webcam[]>({
    queryKey: ["/api/webcams"],
  });

  const selectedWebcam = webcams?.find(w => w.id.toString() === selectedWebcamId);

  // Auto-select camera logic if needed, but user requested NOT to turn on default directly.
  // We only enable "default" option if settings?.enableLocalWebcam is true.

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (selectedWebcamId === "default") {
        if (!settings?.enableLocalWebcam) {
           // If setting is disabled, deselect default
           setSelectedWebcamId("");
           return;
        }

        try {
          setStreamError(null);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setStreamError("Could not access camera. Please allow camera permissions.");
        }
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedWebcamId, settings?.enableLocalWebcam]);

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Live Feed</CardTitle>
        <div className="flex space-x-2">
          <Select value={selectedWebcamId} onValueChange={setSelectedWebcamId}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              {settings?.enableLocalWebcam && (
                <SelectItem value="default">Default Camera</SelectItem>
              )}
              {webcams?.map((cam) => (
                <SelectItem key={cam.id} value={cam.id.toString()}>
                  {cam.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
          {selectedWebcamId === "default" && settings?.enableLocalWebcam ? (
             streamError ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                 <VideoOff className="h-12 w-12 opacity-50 mb-2" />
                 <span>{streamError}</span>
               </div>
             ) : (
               <video 
                 ref={videoRef} 
                 autoPlay 
                 playsInline 
                 muted 
                 className="w-full h-full object-cover"
               />
             )
          ) : selectedWebcam ? (
             selectedWebcam.type === 'mjpeg' ? (
                <img src={selectedWebcam.url} alt={selectedWebcam.name} className="w-full h-full object-cover" />
             ) : selectedWebcam.type === 'rtsp' ? (
                <img 
                  src={`/api/webcams/${selectedWebcam.id}/stream`} 
                  alt={selectedWebcam.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite loop
                    // Could show an error placeholder here if needed
                    console.error("Failed to load RTSP stream");
                  }}
                />
              ) : (
                <iframe src={selectedWebcam.url} className="w-full h-full border-0" allowFullScreen />
             )
          ) : (
             <div className="absolute inset-0 flex items-center justify-center text-white">
               Select a camera
             </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
