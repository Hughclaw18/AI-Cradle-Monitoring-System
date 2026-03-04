import { useState, useEffect } from "react";
import { Bell, Settings, Baby, Play, Square, ChevronDown, History, LayoutDashboard, LogOut, User as UserIcon, Footprints, Volume2, Thermometer } from "lucide-react";
import { getTimeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorCard } from "@/components/sensor-card";
import { SpotifyPlayer } from "@/components/spotify-player";
import { SpotifyConnect } from "@/components/spotify-connect";
// import Detections from "@/components/detection-history";
import DetectionGraph from "@/components/DetectionGraph";
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

interface DetectionEvent {
  type: 'crying' | 'object' | 'temperature';
  timestamp: Date;
  details?: string;
}

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
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [isObjectExpanded, setIsObjectExpanded] = useState(false);
  const [isCryingExpanded, setIsCryingExpanded] = useState(false);
  const [isTemperatureExpanded, setIsTemperatureExpanded] = useState(false);

  useEffect(() => {
    if (sensorData) {
      const newDetections: DetectionEvent[] = [];

      if (sensorData.cryingDetected) {
        newDetections.push({
          type: 'crying',
          timestamp: new Date(sensorData.timestamp),
          details: 'Crying detected',
        });
      }

      const objs = Array.isArray(sensorData.objectDetected) ? sensorData.objectDetected : [];
      if (objs.length > 0) {
        objs.forEach(obj => {
          newDetections.push({
            type: 'object',
            timestamp: new Date(obj.timestamp),
            details: `Object detected: ${obj.object_name}`,
          });
        });
      }

      if (sensorData.temperature > (settings?.tempThreshold || 78)) {
        newDetections.push({
          type: 'temperature',
          timestamp: new Date(sensorData.timestamp),
          details: `High temperature detected: ${sensorData.temperature}°F`,
        });
      }

      if (newDetections.length > 0) {
        setDetections(prevDetections => {
          const uniqueNewDetections = newDetections.filter(
            newDet => !prevDetections.some(
              prevDet => prevDet.type === newDet.type && prevDet.timestamp.getTime() === newDet.timestamp.getTime()
            )
          );
          return [...prevDetections, ...uniqueNewDetections].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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
              animate={{ opacity: connected ? [1, 0.5, 1] : 1 }}
              transition={{ duration: 2, repeat: Infinity }}
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
            <TabsList className="hidden lg:grid w-full grid-cols-4 h-16 p-1.5 bg-muted/50 backdrop-blur rounded-2xl mb-8">
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
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-background">
                    <VideoFeed />
                  </div>

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
                        status={sensorData.temperature > (settings?.tempThreshold || 78) ? 'Critical' : 'Stable'}
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
                        status={sensorData.objectDetected && sensorData.objectDetected.length > 0 ? 'Detected' : 'Secure'}
                        timestamp={getTimeAgo(sensorData.timestamp)}
                        isActive={!!(sensorData.objectDetected && sensorData.objectDetected.length > 0)}
                      />
                      
                      <SensorCard
                        type="crying"
                        value={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                        status={sensorData.cryingDetected ? 'Distress' : 'Quiet'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Object Detections */}
              <Card className="rounded-3xl border-none shadow-xl bg-card/50 backdrop-blur overflow-hidden">
                <CardContent className="p-6">
                  <div 
                    className="flex justify-between items-center mb-6 cursor-pointer md:cursor-default"
                    onClick={() => setIsObjectExpanded(!isObjectExpanded)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-500/10 rounded-xl">
                        <Footprints className="h-5 w-5 text-green-500" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground tracking-tight">Object Events</h3>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform md:hidden ${isObjectExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  <div className={`${isObjectExpanded ? 'block' : 'hidden'} md:block space-y-3`}>
                    {detections?.filter(d => d.type === 'object').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                          <Footprints className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No objects detected.</p>
                      </div>
                    ) : (
                      detections?.filter(d => d.type === 'object').slice(0, 10).map((entry, index) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={index} 
                          className="p-3 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(entry.timestamp), 'p')}</span>
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{format(new Date(entry.timestamp), 'MMM d')}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{entry.details}</p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Crying Detections */}
              <Card className="rounded-3xl border-none shadow-xl bg-card/50 backdrop-blur overflow-hidden">
                <CardContent className="p-6">
                  <div 
                    className="flex justify-between items-center mb-6 cursor-pointer md:cursor-default"
                    onClick={() => setIsCryingExpanded(!isCryingExpanded)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Volume2 className="h-5 w-5 text-amber-500" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground tracking-tight">Audio Events</h3>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform md:hidden ${isCryingExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  <div className={`${isCryingExpanded ? 'block' : 'hidden'} md:block space-y-3`}>
                    {detections?.filter(d => d.type === 'crying').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                          <Volume2 className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No crying events recorded.</p>
                      </div>
                    ) : (
                      detections?.filter(d => d.type === 'crying').slice(0, 10).map((entry, index) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={index} 
                          className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{format(new Date(entry.timestamp), 'p')}</span>
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{format(new Date(entry.timestamp), 'MMM d')}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{entry.details}</p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Temperature Alerts */}
              <Card className="rounded-3xl border-none shadow-xl bg-card/50 backdrop-blur overflow-hidden">
                <CardContent className="p-6">
                  <div 
                    className="flex justify-between items-center mb-6 cursor-pointer md:cursor-default"
                    onClick={() => setIsTemperatureExpanded(!isTemperatureExpanded)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-destructive/10 rounded-xl">
                        <Thermometer className="h-5 w-5 text-destructive" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground tracking-tight">System Alerts</h3>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform md:hidden ${isTemperatureExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  <div className={`${isTemperatureExpanded ? 'block' : 'hidden'} md:block space-y-3`}>
                    {detections?.filter(d => d.type === 'temperature').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                          <Thermometer className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No temperature alerts.</p>
                      </div>
                    ) : (
                      detections?.filter(d => d.type === 'temperature').slice(0, 10).map((entry, index) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={index} 
                          className="p-3 rounded-2xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">{format(new Date(entry.timestamp), 'p')}</span>
                            <span className="text-[10px] font-bold text-destructive uppercase tracking-widest">{format(new Date(entry.timestamp), 'MMM d')}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{entry.details}</p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
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
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
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

      {/* Notification Toasts */}
      <div className="fixed bottom-24 right-4 left-4 md:left-auto md:right-8 z-[110] space-y-3 pointer-events-none">
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
      </div>
    </div>
  );
}

// Add this new component outside the Dashboard function, but within the same file
interface DetectionLogItemProps {
  entry: DetectionEvent;
}

const DetectionLogItem: React.FC<DetectionLogItemProps> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg shadow-sm bg-card">
      <div
        className="flex justify-between items-center p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <p className="text-sm font-medium">
          {entry.type === 'temperature' ? 'Temperature Alert' : `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Detection`}
          <span className="ml-2 text-muted-foreground">{format(new Date(entry.timestamp), 'PPP p')}</span>
        </p>
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
      </div>
      {isExpanded && (
        <div className="p-3 pt-0 border-t">
          <p className="text-sm text-muted-foreground">Details: {entry.details}</p>
        </div>
      )}
    </div>
  );
};
