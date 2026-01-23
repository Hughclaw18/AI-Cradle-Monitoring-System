import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Webcam } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoOff } from "lucide-react";

export function VideoFeed() {
  const [selectedWebcamId, setSelectedWebcamId] = useState<string>("default");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const { data: webcams } = useQuery<Webcam[]>({
    queryKey: ["/api/webcams"],
  });

  const selectedWebcam = webcams?.find(w => w.id.toString() === selectedWebcamId);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (selectedWebcamId === "default") {
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
  }, [selectedWebcamId]);

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Live Feed</CardTitle>
        <div className="flex space-x-2">
           {webcams && webcams.length > 0 && (
             <Select value={selectedWebcamId} onValueChange={setSelectedWebcamId}>
               <SelectTrigger className="w-[180px] h-8">
                 <SelectValue placeholder="Select Camera" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="default">Default Camera</SelectItem>
                 {webcams.map((cam) => (
                   <SelectItem key={cam.id} value={cam.id.toString()}>
                     {cam.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
          {selectedWebcamId === "default" ? (
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-gray-900">
                  <VideoOff className="h-12 w-12 opacity-50 mb-4" />
                  <h3 className="font-semibold mb-2">RTSP Stream Detected</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Browsers cannot play raw RTSP streams ({selectedWebcam.url}) directly.
                  </p>
                  <p className="text-xs text-gray-500">
                    Please use a WebRTC viewer URL if your camera supports it, or configure an RTSP-to-WebRTC proxy.
                  </p>
                </div>
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
