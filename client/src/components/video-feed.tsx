import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Webcam, SystemSettings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoOff, Monitor, Camera, Zap, ShieldCheck } from "lucide-react";
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
  const { videoFrame, connected } = useWebSocket();

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
    <div className="relative group">
      {/* Video Container */}
      <div className="aspect-video bg-neutral-950 rounded-[2rem] overflow-hidden relative border border-white/5 shadow-inner">
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
             videoFrame ? (
                <motion.img 
                  key="simulator"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  src={`data:image/jpeg;base64,${videoFrame}`} 
                  alt="Simulator Feed" 
                  className="w-full h-full object-cover" 
                />
             ) : (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-900"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Zap className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-[0.3em] animate-pulse text-primary">Awaiting Link</div>
                  <div className="text-[10px] opacity-40 mt-2 font-medium">ENCRYPTED DATA STREAM</div>
                </motion.div>
             )
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
               <Monitor className="h-12 w-12 opacity-20" />
             </motion.div>
          )}
        </AnimatePresence>

        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] z-10 opacity-20" />
        
        {/* HUD Overlays */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none z-20">
          <div className="flex justify-between items-start">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 self-start">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Feed</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full self-start">
                <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 shadow-[0_0_8px_#ef4444]")} />
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-tighter">{connected ? "System Online" : "System Offline"}</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full self-start">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-tighter">SECURE CHANNEL</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-1">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-mono text-white">
                {new Date().toISOString().slice(11, 19)} UTC
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4">
            <div className="flex space-x-4">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Source</span>
                <span className="text-[10px] font-black text-white uppercase tracking-wider">{selectedWebcamId.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 transition-transform group-hover:-translate-y-1">
        <div className="bg-background/90 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-1 flex items-center">
          <Select value={selectedWebcamId} onValueChange={setSelectedWebcamId}>
            <SelectTrigger className="w-[200px] h-10 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold uppercase tracking-widest">
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4 text-primary" />
                <SelectValue placeholder="SWITCH CHANNEL" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-2">
              {settings?.enableLocalWebcam && (
                <SelectItem value="default" className="text-xs font-bold uppercase tracking-widest">LOCAL SENSOR</SelectItem>
              )}
              <SelectItem value="simulator_ws" className="text-xs font-bold uppercase tracking-widest">SIMULATOR NET</SelectItem>
              {webcams?.map((cam) => (
                <SelectItem key={cam.id} value={cam.id.toString()} className="text-xs font-bold uppercase tracking-widest">
                  {cam.name.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
