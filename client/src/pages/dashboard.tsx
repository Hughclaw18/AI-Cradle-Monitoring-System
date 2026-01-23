import { useState, useEffect } from "react";
import { Bell, Settings, Baby, Play, Square, ChevronDown, History, LayoutDashboard, LogOut } from "lucide-react";
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

      if (sensorData.objectDetected && sensorData.objectDetected.length > 0) {
        sensorData.objectDetected.forEach(obj => {
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
    <div className="max-w-sm mx-auto bg-background min-h-screen shadow-lg relative">
      {/* Status Bar */}
      <div className="bg-primary text-primary-foreground px-4 py-2 flex justify-between items-center text-sm">
        <span>{new Date().toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        })}</span>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-background shadow-sm border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Baby className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Smart Cradle</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {notifications.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllNotifications}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex flex-col items-center p-2">
              <LayoutDashboard className="h-4 w-4 mb-1" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="music" className="flex flex-col items-center p-2">
              <Play className="h-4 w-4 mb-1" />
              <span className="text-xs">Music</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col items-center p-2">
              <History className="h-4 w-4 mb-1" />
              <span className="text-xs">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col items-center p-2">
              <Settings className="h-4 w-4 mb-1" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {/* Live Video Feed */}
            <VideoFeed/>

            {/* System Status */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">System Status</h2>
                  <Button variant="outline" size="sm" className="text-sm">
                    View Details
                  </Button>
                </div>
                {sensorData && (
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                    <SensorCard
                      type="temperature"
                      value={`${Math.round(sensorData.temperature)}°F`}
                      status={sensorData.temperature > (settings?.tempThreshold || 78) ? 'High' : 'Normal'}
                      timestamp={getTimeAgo(sensorData.timestamp)}
                      isAlert={sensorData.temperature > (settings?.tempThreshold || 78)}
                      threshold={settings?.tempThreshold}
                      currentValue={sensorData.temperature}
                    />
                    
                    
                    <SensorCard
                      type="object"
                      value={sensorData.objectDetected && sensorData.objectDetected.length > 0 
                        ? `${sensorData.objectDetected[0].object_name} at ${new Date(sensorData.objectDetected[0].timestamp).toLocaleTimeString()}` 
                        : 'No Object'}
                      status={sensorData.objectDetected && sensorData.objectDetected.length > 0 ? 'Active' : 'Inactive'}
                      timestamp={getTimeAgo(sensorData.timestamp)}
                      isActive={!!(sensorData.objectDetected && sensorData.objectDetected.length > 0)}
                    />
                    
                    <SensorCard
                      type="crying"
                      value={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                      status={sensorData.cryingDetected ? 'Crying' : 'Quiet'}
                      timestamp={getTimeAgo(sensorData.timestamp)}
                      isActive={sensorData.cryingDetected}
                      isAlert={sensorData.cryingDetected}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-foreground mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleEmergencyStop}
                    className="flex items-center justify-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>Stop All</span>
                  </Button>
                  <Button
                    onClick={handleStartLullaby}
                    className="bg-green-500 hover:bg-green-600 flex items-center justify-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Play Music</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="music" className="mt-4 space-y-4">
            <SpotifyPlayer musicStatus={musicStatus || undefined} />
            <SpotifyConnect />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">Detection History</h2>

                {/* Object Detections */}
                <div className="border rounded-lg shadow-sm bg-card mb-4">
                  <div
                    className="flex justify-between items-center p-3 cursor-pointer"
                    onClick={() => setIsObjectExpanded(!isObjectExpanded)}
                  >
                    <h3 className="font-medium text-foreground">Object Detections</h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isObjectExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  {isObjectExpanded && (
                    <div className="p-3 pt-0 border-t space-y-2">
                      {detections?.filter(d => d.type === 'object').length === 0 ? (
                        <p className="text-muted-foreground">No object detections.</p>
                      ) : (
                        detections?.filter(d => d.type === 'object').map((entry, index) => (
                          <div key={index} className="p-2 border rounded">
                            <p className="text-sm">Time: {format(new Date(entry.timestamp), 'PPP p')}</p>
                            <p className="text-sm">Details: {entry.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Crying Detections */}
                <div className="border rounded-lg shadow-sm bg-card mb-4">
                  <div
                    className="flex justify-between items-center p-3 cursor-pointer"
                    onClick={() => setIsCryingExpanded(!isCryingExpanded)}
                  >
                    <h3 className="font-medium text-foreground">Crying Detections</h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isCryingExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  {isCryingExpanded && (
                    <div className="p-3 pt-0 border-t space-y-2">
                      {detections?.filter(d => d.type === 'crying').length === 0 ? (
                        <p className="text-muted-foreground">No crying detections.</p>
                      ) : (
                        detections?.filter(d => d.type === 'crying').map((entry, index) => (
                          <div key={index} className="p-2 border rounded">
                            <p className="text-sm">Time: {format(new Date(entry.timestamp), 'PPP p')}</p>
                            <p className="text-sm">Details: {entry.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Temperature Detections */}
                <div className="border rounded-lg shadow-sm bg-card">
                  <div
                    className="flex justify-between items-center p-3 cursor-pointer"
                    onClick={() => setIsTemperatureExpanded(!isTemperatureExpanded)}
                  >
                    <h3 className="font-medium text-foreground">Temperature Alerts</h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isTemperatureExpanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  {isTemperatureExpanded && (
                    <div className="p-3 pt-0 border-t space-y-2">
                      {detections?.filter(d => d.type === 'temperature').length === 0 ? (
                        <p className="text-muted-foreground">No temperature alerts.</p>
                      ) : (
                        detections?.filter(d => d.type === 'temperature').map((entry, index) => (
                          <div key={index} className="p-2 border rounded">
                            <p className="text-sm">Time: {format(new Date(entry.timestamp), 'PPP p')}</p>
                            <p className="text-sm">Details: {entry.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <SettingsPanel
              settings={settings || defaultSettings}
              onUpdateSettings={handleUpdateSettings}
              onReconnect={handleReconnect}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={handleEmergencyStop}
          className="w-14 h-14 bg-primary hover:bg-primary/90 rounded-full shadow-lg flex items-center justify-center"
        >
          <Baby className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>

      {/* Notification Toasts */}
      {notifications.map((notification, index) => (
        <NotificationToast
          key={index}
          title={notification.title}
          message={notification.message}
          severity={notification.severity}
          onDismiss={() => dismissNotification(index)}
          duration={8000} // Set duration to 8 seconds
        />
      ))}
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
