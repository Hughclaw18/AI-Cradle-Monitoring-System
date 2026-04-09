import { useState, useEffect } from "react";
import { Bell, Settings, Baby, Play, Square, History, LayoutDashboard, LogOut, User as UserIcon, Volume2, Thermometer, BedDouble } from "lucide-react";
import { getTimeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorCard } from "@/components/sensor-card";
import { SpotifyPlayer } from "@/components/spotify-player";
import { SpotifyConnect } from "@/components/spotify-connect";
import { DetectionList } from "@/components/detection-list";
import { EventLog, type LogEvent } from "@/components/event-log";
import { SleepPositionLog } from "@/components/sleep-position-log";
import { SettingsPanel } from "@/components/settings-panel";
import { NotificationToast } from "@/components/notification-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { SystemSettings, SensorData } from "@shared/schema";
import { format } from 'date-fns';
import { VideoFeed } from "@/components/video-feed";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { pulsingOpacity, emergencyButtonAnimation } from "@/lib/animations"; // Import variants

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const {
    connected,
    sensorData,
    servoStatus,
    musicStatus,
    settings,
    notifications,
    dismissNotification,
    clearAllNotifications,
  } = useWebSocket();

  const { permission, requestPermission, showAlert } = useNotifications();
  const [activeTab, setActiveTab] = useState("dashboard");

  const defaultSettings: SystemSettings = {
    id: 0,
    userId: user?.id || 0,
    tempThreshold: 78,
    motionSensitivity: 3,
    cryingDetectionEnabled: true,
    autoResponse: true,
    nightMode: false,
    pushNotifications: true,
    tempAlerts: true,
    enableLocalWebcam: false,
    motionAlerts: false,
  };
  const [detections, setDetections] = useState<LogEvent[]>([]);

  useEffect(() => {
    if (sensorData) {
      const HAZARDOUS = new Set(["knife","scissors","lighter","coin","battery","pin","nail","glass","medicine","plastic_bag","small_marble","sharp_toy","hot_liquid","insect"]);
      const newDetections: LogEvent[] = [];
      const ts = new Date(sensorData.timestamp);

      if (sensorData.cryingDetected) {
        newDetections.push({ id: `cry-live-${ts.getTime()}`, type: "crying", timestamp: ts, detail: "Crying detected", severity: "warning" });
      }

      const objs = Array.isArray(sensorData.objectDetected) ? sensorData.objectDetected : [];
      objs.forEach(obj => {
        const isHazard = HAZARDOUS.has(obj.object_name?.toLowerCase());
        newDetections.push({ id: `obj-live-${ts.getTime()}-${obj.object_name}`, type: "object", timestamp: new Date(obj.timestamp ?? ts), detail: obj.object_name, severity: isHazard ? "danger" : "info" });
      });

      if (sensorData.temperature > (settings?.tempThreshold || 78)) {
        newDetections.push({ id: `temp-live-${ts.getTime()}`, type: "temperature", timestamp: ts, detail: `${sensorData.temperature.toFixed(1)}°F`, severity: sensorData.temperature > 85 ? "danger" : "warning" });
      }

      if (newDetections.length > 0) {
        setDetections(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const fresh = newDetections.filter(e => !existingIds.has(e.id));
          return [...fresh, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        });
      }
    }
  }, [sensorData]);

  // Mutations
  const updateMusicMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/music/status', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/music/status'] });
    },
  });

  const updateServoMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/servo/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servo/status'] });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: (position: number) => apiRequest('POST', '/api/servo/position', { position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servo/status'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => apiRequest('POST', '/api/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  // Request notification permission on mount
  useEffect(() => {
    if (permission.default) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Show browser notifications for alerts
  useEffect(() => {
    notifications.forEach((notification, index) => {
      if (permission.granted) {
        showAlert(notification.title, notification.message, notification.severity);
      }
    });
  }, [notifications, permission, showAlert]);

  // Toggle dark mode based on nightMode setting
  useEffect(() => {
    if (settings?.nightMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.nightMode]);

  // Handler functions
  const handlePlayPause = () => {
    updateMusicMutation.mutate({
      isPlaying: !musicStatus?.isPlaying,
    });
  };

  const handleVolumeChange = (volume: number) => {
    updateMusicMutation.mutate({ volume });
  };

  const handleMoveLeft = () => {
    const newPosition = Math.max(0, (servoStatus?.position || 45) - 15);
    updatePositionMutation.mutate(newPosition);
  };

  const handleMoveRight = () => {
    const newPosition = Math.min(180, (servoStatus?.position || 45) + 15);
    updatePositionMutation.mutate(newPosition);
  };

  const handleStop = () => {
    updateServoMutation.mutate({
      isMoving: false,
      autoRock: false,
    });
  };

  const handleToggleAutoRock = (enabled: boolean) => {
    updateServoMutation.mutate({
      autoRock: enabled,
      isMoving: enabled,
    });
  };

  const handleEmergencyStop = () => {
    updateMusicMutation.mutate({ isPlaying: false });
    updateServoMutation.mutate({
      isMoving: false,
      autoRock: false,
    });
  };

  const handleStartLullaby = () => {
    updateMusicMutation.mutate({
      isPlaying: true,
      currentTrack: null, // Updated to a hardcoded value
    });
  };

  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    updateSettingsMutation.mutate(newSettings);
  };

  const handleReconnect = () => {
    window.location.reload();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Status Bar */}
      <div className="bg-primary text-primary-foreground px-4 py-2 flex justify-between items-center text-xs font-bold tracking-widest uppercase">
        <span>{new Date().toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        })}</span>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <motion.div 
              variants={pulsingOpacity} // Use pulsingOpacity variant
              animate="animate"
              className={`w-2.5 h-2.5 rounded-full shadow-sm ${connected ? 'bg-green-400 shadow-green-400/50' : 'bg-destructive shadow-destructive/50'}`} 
            />
            <span className="text-[10px]">{connected ? 'Live Sync' : 'Offline'}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto lg:px-8">
        {/* Header */}
        <header className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/50 transition-all duration-300">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2.5 bg-primary/10 rounded-2xl">
                <Baby className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none">Smart Cradle</h1>
                <p className="text-xs font-medium text-muted-foreground mt-1">Nursery Intelligence System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative mr-2">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-background">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Guardian Profile</DialogTitle>
                    <DialogDescription>
                      Secure identity and system access details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-6">
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                      <Input id="name" value={user?.name || ""} readOnly className="bg-muted/50 border-none h-12 text-base font-medium" />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System ID</Label>
                      <Input id="username" value={user?.username || ""} readOnly className="bg-muted/50 border-none h-12 text-base font-medium" />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notification Email</Label>
                      <Input id="email" value={user?.email || ""} readOnly className="bg-muted/50 border-none h-12 text-base font-medium" />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-8 pb-32 lg:pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="hidden lg:grid w-full grid-cols-5 h-16 p-1.5 bg-muted/50 backdrop-blur rounded-2xl mb-8">
              <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center">
                  <LayoutDashboard className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="music" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center">
                  <Play className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Media</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center">
                  <History className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Log</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="sleep" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center">
                  <BedDouble className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Sleep</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center">
                  <Settings className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Config</span>
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Responsive Grid Layout for Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Video Feed */}
                <div className="lg:col-span-8 space-y-6">
                  <VideoFeed settings={settings || defaultSettings} />

                  {/* Quick Actions Desktop */}
                  <div className="hidden lg:grid grid-cols-3 gap-4">
                    <Button
                      variant="destructive"
                      onClick={handleEmergencyStop}
                      className="h-20 rounded-2xl shadow-lg shadow-destructive/20 text-lg font-bold flex flex-col space-y-1 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Square className="h-6 w-6" />
                      <span>System Halt</span>
                    </Button>
                    <Button
                      onClick={handleStartLullaby}
                      className="h-20 bg-green-500 hover:bg-green-600 rounded-2xl shadow-lg shadow-green-500/20 text-lg font-bold flex flex-col space-y-1 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play className="h-6 w-6" />
                      <span>Lullaby</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("settings")}
                      className="h-20 rounded-2xl border-2 text-lg font-bold flex flex-col space-y-1 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Settings className="h-6 w-6" />
                      <span>Configure</span>
                    </Button>
                  </div>
                </div>

                {/* Right Column: Sensors */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">Telemetry</h2>
                    <div className="px-2 py-1 bg-primary/10 rounded-lg text-[10px] font-bold text-primary uppercase">Real-time</div>
                  </div>
                  
                  {sensorData ? (
                    <div className="grid grid-cols-1 gap-4">
                      <SensorCard
                        type="temperature"
                        value={`${Math.round(sensorData.temperature)}°F`}
                        status={sensorData.temperature > (settings?.tempThreshold || 78) ? 'Critical' : 'Normal'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isAlert={sensorData.temperature > (settings?.tempThreshold || 78)}
                        threshold={settings?.tempThreshold}
                        currentValue={sensorData.temperature}
                      />
                      
                      <SensorCard
                        type="object"
                        value={sensorData.objectDetected && sensorData.objectDetected.length > 0 
                          ? sensorData.objectDetected[0].object_name 
                          : 'Clear'}
                        status={sensorData.objectDetected && sensorData.objectDetected.length > 0 ? 'Detected' : 'Clear'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isActive={!!(sensorData.objectDetected && sensorData.objectDetected.length > 0)}
                      />
                      
                      <SensorCard
                        type="crying"
                        value={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                        status={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isActive={sensorData.cryingDetected}
                        isAlert={sensorData.cryingDetected}
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed border-muted">
                      <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      <p className="text-sm font-medium text-muted-foreground italic">Establishing link...</p>
                    </div>
                  )}

                  {/* Quick Actions Mobile/Tablet Only */}
                  <div className="lg:hidden space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">Rapid Control</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="destructive"
                        onClick={handleEmergencyStop}
                        className="h-16 rounded-2xl shadow-lg shadow-destructive/20 font-bold space-x-2"
                      >
                        <Square className="h-5 w-5" />
                        <span>Stop All</span>
                      </Button>
                      <Button
                        onClick={handleStartLullaby}
                        className="h-16 bg-green-500 hover:bg-green-600 rounded-2xl shadow-lg shadow-green-500/20 font-bold space-x-2"
                      >
                        <Play className="h-5 w-5" />
                        <span>Lullaby</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

          <TabsContent value="music" className="mt-4 space-y-4">
            <SpotifyPlayer musicStatus={musicStatus || undefined} />
            <SpotifyConnect />
          </TabsContent>

          <TabsContent value="history" className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EventLog liveEvents={detections} />
          </TabsContent>

          <TabsContent value="sleep" className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SleepPositionLog currentPosition={(sensorData as any)?.sleepingPosition} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsPanel
              settings={settings || defaultSettings}
              onUpdateSettings={handleUpdateSettings}
              onReconnect={handleReconnect}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>

      {/* Floating Emergency Action Button */}
      <AnimatePresence>
        <motion.div 
          variants={emergencyButtonAnimation} // Use emergencyButtonAnimation variant
          initial="initial"
          animate="animate"
          whileHover="whileHover"
          whileTap="whileTap"
          className="fixed bottom-24 lg:bottom-6 right-6 z-[100]"
        >
          <Button
            onClick={handleEmergencyStop}
            className="w-14 h-14 bg-destructive hover:bg-destructive/90 rounded-2xl shadow-2xl shadow-destructive/40 flex items-center justify-center border-4 border-background p-0"
          >
            <Square className="h-6 w-6 text-destructive-foreground fill-current" />
          </Button>
        </motion.div>
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe px-6 h-20">
        <div className="flex items-center justify-between h-full max-w-md mx-auto">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Live" },
            { id: "music", icon: Play, label: "Media" },
            { id: "history", icon: History, label: "Log" },
            { id: "sleep", icon: BedDouble, label: "Sleep" },
            { id: "settings", icon: Settings, label: "Config" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 w-16 transition-all",
                activeTab === item.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                activeTab === item.id ? "bg-primary/10" : ""
              )}>

                <item.icon className={cn(
                  "h-5 w-5",
                  activeTab === item.id ? "stroke-[2.5px]" : "stroke-2"
                )} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                {item.label}
              </span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="mobile-nav-dot"
                  className="w-1 h-1 rounded-full bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Toasts — top-right on desktop, above mobile nav on mobile */}
      <div className="fixed top-20 right-4 z-[200] flex flex-col gap-3 w-[90vw] max-w-sm md:w-80 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notification, index) => (
            <NotificationToast
              key={index}
              title={notification.title}
              message={notification.message}
              severity={notification.severity}
              onDismiss={() => dismissNotification(index)}
              duration={8000}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

