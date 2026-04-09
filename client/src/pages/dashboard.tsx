import { useState, useEffect } from "react";
import { Bell, Settings, Baby, Play, Square, History, LayoutDashboard, LogOut, User as UserIcon, BedDouble } from "lucide-react";
import { getTimeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorCard } from "@/components/sensor-card";
import { SpotifyPlayer } from "@/components/spotify-player";
import { SpotifyConnect } from "@/components/spotify-connect";
import { EventLog, type LogEvent } from "@/components/event-log";
import { SleepPositionLog } from "@/components/sleep-position-log";
import { SettingsPanel } from "@/components/settings-panel";
import { NotificationToast } from "@/components/notification-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SystemSettings } from "@shared/schema";
import { VideoFeed } from "@/components/video-feed";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { pulsingOpacity, emergencyButtonAnimation } from "@/lib/animations";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const {
    connected, sensorData, servoStatus, musicStatus, settings,
    notifications, dismissNotification,
  } = useWebSocket();

  const { permission, requestPermission, showAlert } = useNotifications();
  const [activeTab, setActiveTab] = useState("dashboard");

  const defaultSettings: SystemSettings = {
    id: 0, userId: user?.id || 0, tempThreshold: 78, motionSensitivity: 3,
    cryingDetectionEnabled: true, autoResponse: true, nightMode: false,
    pushNotifications: true, tempAlerts: true, enableLocalWebcam: false, motionAlerts: false,
  };

  const [detections, setDetections] = useState<LogEvent[]>([]);

  useEffect(() => {
    if (!sensorData) return;
    const HAZARDOUS = new Set(["knife","scissors","lighter","coin","battery","pin","nail","glass","medicine","plastic_bag","small_marble","sharp_toy","hot_liquid","insect"]);
    const ts = new Date(sensorData.timestamp);
    const next: LogEvent[] = [];

    if (sensorData.cryingDetected)
      next.push({ id: `cry-live-${ts.getTime()}`, type: "crying", timestamp: ts, detail: "Crying detected", severity: "warning" });

    (Array.isArray(sensorData.objectDetected) ? sensorData.objectDetected : []).forEach(obj => {
      next.push({ id: `obj-live-${ts.getTime()}-${obj.object_name}`, type: "object", timestamp: new Date(obj.timestamp ?? ts), detail: obj.object_name, severity: HAZARDOUS.has(obj.object_name?.toLowerCase()) ? "danger" : "info" });
    });

    if (sensorData.temperature > (settings?.tempThreshold || 78))
      next.push({ id: `temp-live-${ts.getTime()}`, type: "temperature", timestamp: ts, detail: `${sensorData.temperature.toFixed(1)}°F`, severity: sensorData.temperature > 85 ? "danger" : "warning" });

    if (next.length > 0)
      setDetections(prev => {
        const ids = new Set(prev.map(e => e.id));
        return [...next.filter(e => !ids.has(e.id)), ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      });
  }, [sensorData]);

  const updateMusicMutation    = useMutation({ mutationFn: (d: any) => apiRequest('POST', '/api/music/status', d),   onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/music/status'] }) });
  const updateServoMutation    = useMutation({ mutationFn: (d: any) => apiRequest('POST', '/api/servo/settings', d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/servo/status'] }) });
  const updateSettingsMutation = useMutation({ mutationFn: (d: Partial<SystemSettings>) => apiRequest('POST', '/api/settings', d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/settings'] }) });

  useEffect(() => { if (permission.default) requestPermission(); }, [permission, requestPermission]);
  useEffect(() => {
    notifications.forEach(n => { if (permission.granted) showAlert(n.title, n.message, n.severity); });
  }, [notifications, permission, showAlert]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!settings?.nightMode);
  }, [settings?.nightMode]);

  const handleEmergencyStop = () => {
    updateMusicMutation.mutate({ isPlaying: false });
    updateServoMutation.mutate({ isMoving: false, autoRock: false });
  };
  const handleStartLullaby   = () => updateMusicMutation.mutate({ isPlaying: true, currentTrack: null });
  const handleUpdateSettings = (s: Partial<SystemSettings>) => updateSettingsMutation.mutate(s);
  const handleReconnect      = () => window.location.reload();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Status bar ── */}
      <div className="shrink-0 bg-primary text-primary-foreground px-4 py-2 flex justify-between items-center text-xs font-bold tracking-widest uppercase z-50">
        <span>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        <div className="flex items-center space-x-1.5">
          <motion.div variants={pulsingOpacity} animate="animate"
            className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 shadow-green-400/50' : 'bg-destructive shadow-destructive/50'}`} />
          <span className="text-[10px]">{connected ? 'Live Sync' : 'Offline'}</span>
        </div>
      </div>

      {/* ── Header ── */}
      <header className="shrink-0 w-full bg-background/90 backdrop-blur-md border-b border-border/50 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-2xl">
              <Baby className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">Smart Cradle</h1>
              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Nursery Intelligence System</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-background">
                  {notifications.length}
                </span>
              )}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">Guardian Profile</DialogTitle>
                  <DialogDescription>Secure identity and system access details.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                  {[["name","Full Name",user?.name],["username","System ID",user?.username],["email","Notification Email",user?.email]].map(([id,label,val]) => (
                    <div key={id} className="flex flex-col space-y-2">
                      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
                      <Input id={id} value={val || ""} readOnly className="bg-muted/50 border-none h-12 text-base font-medium" />
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-24 lg:pb-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

            {/* Desktop tab bar */}
            <TabsList className="hidden lg:grid w-full grid-cols-5 h-14 p-1.5 bg-muted/50 backdrop-blur rounded-2xl mb-6">
              {[
                { v: "dashboard", icon: LayoutDashboard, label: "Live" },
                { v: "music",     icon: Play,            label: "Media" },
                { v: "history",   icon: History,         label: "Log" },
                { v: "sleep",     icon: BedDouble,       label: "Sleep" },
                { v: "settings",  icon: Settings,        label: "Config" },
              ].map(({ v, icon: Icon, label }) => (
                <TabsTrigger key={v} value={v} className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                  <div className="flex flex-col items-center">
                    <Icon className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Live */}
            <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  <VideoFeed settings={settings || defaultSettings} />
                  <div className="hidden lg:grid grid-cols-3 gap-4">
                    <Button variant="destructive" onClick={handleEmergencyStop} className="h-16 rounded-2xl font-bold flex flex-col space-y-1">
                      <Square className="h-5 w-5" /><span>System Halt</span>
                    </Button>
                    <Button onClick={handleStartLullaby} className="h-16 bg-green-500 hover:bg-green-600 rounded-2xl font-bold flex flex-col space-y-1">
                      <Play className="h-5 w-5" /><span>Lullaby</span>
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("settings")} className="h-16 rounded-2xl border-2 font-bold flex flex-col space-y-1">
                      <Settings className="h-5 w-5" /><span>Configure</span>
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold tracking-tight">Telemetry</h2>
                    <span className="px-2 py-1 bg-primary/10 rounded-lg text-[10px] font-bold text-primary uppercase">Real-time</span>
                  </div>

                  {sensorData ? (
                    <div className="grid grid-cols-1 gap-3">
                      <SensorCard type="temperature" value={`${Math.round(sensorData.temperature)}°F`}
                        status={sensorData.temperature > (settings?.tempThreshold || 78) ? 'Critical' : 'Normal'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isAlert={sensorData.temperature > (settings?.tempThreshold || 78)}
                        threshold={settings?.tempThreshold} currentValue={sensorData.temperature} />
                      <SensorCard type="object"
                        value={sensorData.objectDetected?.length ? sensorData.objectDetected[0].object_name : 'Clear'}
                        status={sensorData.objectDetected?.length ? 'Detected' : 'Clear'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isActive={!!sensorData.objectDetected?.length} />
                      <SensorCard type="crying" value={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                        status={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isActive={sensorData.cryingDetected} isAlert={sensorData.cryingDetected} />
                    </div>
                  ) : (
                    <div className="h-56 flex flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed border-muted">
                      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      <p className="text-sm font-medium text-muted-foreground italic">Establishing link...</p>
                    </div>
                  )}

                  <div className="lg:hidden grid grid-cols-2 gap-3 pt-2">
                    <Button variant="destructive" onClick={handleEmergencyStop} className="h-14 rounded-2xl font-bold gap-2">
                      <Square className="h-4 w-4" /><span>Stop All</span>
                    </Button>
                    <Button onClick={handleStartLullaby} className="h-14 bg-green-500 hover:bg-green-600 rounded-2xl font-bold gap-2">
                      <Play className="h-4 w-4" /><span>Lullaby</span>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Media */}
            <TabsContent value="music" className="mt-2 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SpotifyPlayer musicStatus={musicStatus || undefined} />
              <SpotifyConnect />
            </TabsContent>

            {/* Log */}
            <TabsContent value="history" className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <EventLog liveEvents={detections} />
            </TabsContent>

            {/* Sleep */}
            <TabsContent value="sleep" className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SleepPositionLog currentPosition={(sensorData as any)?.sleepingPosition} />
            </TabsContent>

            {/* Config */}
            <TabsContent value="settings" className="mt-2 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SettingsPanel settings={settings || defaultSettings} onUpdateSettings={handleUpdateSettings} onReconnect={handleReconnect} />
            </TabsContent>

          </Tabs>
        </main>
      </div>

      {/* ── Floating emergency button ── */}
      <AnimatePresence>
        <motion.div variants={emergencyButtonAnimation} initial="initial" animate="animate" whileHover="whileHover" whileTap="whileTap"
          className="fixed bottom-24 lg:bottom-6 right-5 z-[100]">
          <Button onClick={handleEmergencyStop}
            className="w-13 h-13 bg-destructive hover:bg-destructive/90 rounded-2xl shadow-2xl shadow-destructive/40 flex items-center justify-center border-4 border-background p-3">
            <Square className="h-5 w-5 text-destructive-foreground fill-current" />
          </Button>
        </motion.div>
      </AnimatePresence>

      {/* ── Mobile bottom nav ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 h-20 shrink-0">
        <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Live" },
            { id: "music",     icon: Play,            label: "Media" },
            { id: "history",   icon: History,         label: "Log" },
            { id: "sleep",     icon: BedDouble,       label: "Sleep" },
            { id: "settings",  icon: Settings,        label: "Config" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn("flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all",
                activeTab === id ? "text-primary" : "text-muted-foreground")}>
              <div className={cn("p-1.5 rounded-xl", activeTab === id ? "bg-primary/10" : "")}>
                <Icon className={cn("h-5 w-5", activeTab === id ? "stroke-[2.5px]" : "stroke-2")} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">{label}</span>
              {activeTab === id && <motion.div layoutId="mobile-nav-dot" className="w-1 h-1 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification toasts ── */}
      <div className="fixed top-20 right-4 z-[200] flex flex-col gap-3 w-[90vw] max-w-sm md:w-80 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n, i) => (
            <NotificationToast key={i} title={n.title} message={n.message} severity={n.severity}
              onDismiss={() => dismissNotification(i)} duration={8000} />
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
