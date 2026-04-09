import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Webcam, SystemSettings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoOff, Camera, Zap, ShieldCheck } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface VideoFeedProps {
  settings?: SystemSettings;
}

export function VideoFeed({ settings }: VideoFeedProps) {
  const [selectedWebcamId, setSelectedWebcamId] = useState<string>("simulator_ws");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  // Key bumped when user switches back to simulator channel to force <img> reload
  const [mjpegKey, setMjpegKey] = useState(0);
  const { connected } = useWebSocket();

  useEffect(() => {
    if (selectedWebcamId === "simulator_ws") setMjpegKey(k => k + 1);
  }, [selectedWebcamId]);

  const { data: webcams } = useQuery<Webcam[]>({
    queryKey: ["/api/webcams"],
  });

  const selectedWebcam = webcams?.find(w => w.id.toString() === selectedWebcamId);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (selectedWebcamId === "default") {
        if (!settings?.enableLocalWebcam) {
           setSelectedWebcamId("simulator_ws");
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
          setStreamError("Permission Denied");
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
    <div className="flex flex-col space-y-4 lg:space-y-6">
      {/* Video Container */}
      <div className="aspect-video bg-neutral-950 rounded-3xl overflow-hidden relative border border-white/5 shadow-2xl group">
        <AnimatePresence mode="wait">
          {selectedWebcamId === "default" && settings?.enableLocalWebcam ? (
             streamError ? (
               <motion.div 
                 key="error"
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center bg-neutral-900"
               >
                 <VideoOff className="h-16 w-16 text-destructive mb-4" />
                 <span className="text-sm font-bold uppercase tracking-widest">{streamError}</span>
               </motion.div>
             ) : (
               <motion.video 
                 key="local"
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 ref={videoRef} autoPlay playsInline muted 
                 className="w-full h-full object-cover grayscale-[0.2] contrast-125"
               />
             )
          ) : selectedWebcamId === "simulator_ws" ? (
             <motion.div key="simulator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
               <img
                 key={mjpegKey}
                 src="/api/stream/live"
                 alt="Simulator Live Feed"
                 className="w-full h-full object-cover"
                 onError={() => setStreamError("Stream unavailable — start the simulator and upload a video.")}
               />
               {streamError && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-900/80 p-4 text-center">
                   <Zap className="h-10 w-10 text-primary mb-3" />
                   <span className="text-xs font-bold uppercase tracking-widest">{streamError}</span>
                 </div>
               )}
             </motion.div>
          ) : selectedWebcam ? (
             <motion.div key="cam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
               {selectedWebcam.type === 'mjpeg' ? (
                  <img src={selectedWebcam.url} alt={selectedWebcam.name} className="w-full h-full object-cover" />
               ) : selectedWebcam.type === 'rtsp' ? (
                  <img 
                    src={`/api/webcams/${selectedWebcam.id}/stream`} 
                    alt={selectedWebcam.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <iframe src={selectedWebcam.url} className="w-full h-full border-0" allowFullScreen />
               )}
             </motion.div>
          ) : (
             <motion.div 
               key="placeholder"
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 flex items-center justify-center text-white bg-neutral-900"
             >
               <Camera className="h-12 w-12 opacity-20" />
             </motion.div>
          )}
        </AnimatePresence>

        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] z-10 opacity-20" />
        
        {/* Minimal Source Overlay - Still helpful but unobtrusive */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{selectedWebcamId.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Info & Controls Panel Below Video */}
      {/* Info & Controls Panel */}
      <div className="flex flex-col gap-3 bg-card/30 backdrop-blur-xl border border-border/50 rounded-2xl p-3 shadow-xl">
        {/* Status badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Live</span>
          </div>
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
            connected ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20")}>
            <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-red-500")} />
            <span className={cn("text-[10px] font-bold uppercase", connected ? "text-green-500" : "text-red-500")}>
              {connected ? "Online" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full border border-border/50">
            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase">Secure</span>
          </div>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {new Date().toISOString().slice(11, 19)} UTC
          </span>
        </div>

        {/* Channel selector — full width on mobile */}
        <Select value={selectedWebcamId} onValueChange={setSelectedWebcamId}>
          <SelectTrigger className="w-full h-10 rounded-xl border-2 bg-background/50 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
              <SelectValue placeholder="Switch channel" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {settings?.enableLocalWebcam && (
              <SelectItem value="default" className="text-xs font-bold uppercase">Local Camera</SelectItem>
            )}
            <SelectItem value="simulator_ws" className="text-xs font-bold uppercase">Simulator Feed</SelectItem>
            {webcams?.map(cam => (
              <SelectItem key={cam.id} value={cam.id.toString()} className="text-xs font-bold uppercase">
                {cam.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
