import { useState, useEffect } from "react";
import { Bell, Settings, Baby, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorCard } from "@/components/sensor-card";
import { SpotifyPlayer } from "@/components/spotify-player";
import { SpotifyConnect } from "@/components/spotify-connect";
import { ServoControl } from "@/components/servo-control";
import { SettingsPanel } from "@/components/settings-panel";
import { NotificationToast } from "@/components/notification-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { SystemSettings } from "@shared/schema";

export default function Dashboard() {
  const {
    connected,
    sensorData,
    servoStatus,
    musicStatus,
    settings,
    notifications,
    dismissNotification,
  } = useWebSocket();

  const { permission, requestPermission, showAlert } = useNotifications();
  const [activeTab, setActiveTab] = useState("dashboard");

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
      currentTrack: "Brahms Lullaby", // Updated to a hardcoded value
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

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen shadow-lg relative">
      {/* Status Bar */}
      <div className="bg-indigo-500 text-white px-4 py-2 flex justify-between items-center text-sm">
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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Baby className="h-6 w-6 text-indigo-500" />
            <h1 className="text-xl font-semibold text-gray-800">Baby Monitor</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              {notifications.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex flex-col items-center p-2">
              <Settings className="h-4 w-4 mb-1" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="music" className="flex flex-col items-center p-2">
              <Play className="h-4 w-4 mb-1" />
              <span className="text-xs">Music</span>
            </TabsTrigger>
            <TabsTrigger value="control" className="flex flex-col items-center p-2">
              <Settings className="h-4 w-4 mb-1" />
              <span className="text-xs">Control</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col items-center p-2">
              <Settings className="h-4 w-4 mb-1" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {/* System Status */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">System Status</h2>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className={`text-sm font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
                      {connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Last update: {sensorData ? getTimeAgo(sensorData.timestamp) : 'Never'}
                </div>
              </CardContent>
            </Card>

            {/* Sensor Cards */}
            <div className="space-y-4">
              {sensorData && (
                <>
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
                    type="motion"
                    value={sensorData.motionDetected ? 'Motion' : 'No Motion'}
                    status={sensorData.motionDetected ? 'Active' : 'Inactive'}
                    timestamp={getTimeAgo(sensorData.timestamp)}
                    isActive={sensorData.motionDetected}
                  />
                  
                  <SensorCard
                    type="crying"
                    value={sensorData.cryingDetected ? 'Detected' : 'Silent'}
                    status={sensorData.cryingDetected ? 'Crying' : 'Quiet'}
                    timestamp={getTimeAgo(sensorData.timestamp)}
                    isActive={sensorData.cryingDetected}
                    isAlert={sensorData.cryingDetected}
                  />
                </>
              )}
            </div>

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-800 mb-3">Quick Actions</h3>
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

          <TabsContent value="control" className="mt-4">
            <ServoControl
              position={servoStatus?.position || 45}
              isMoving={servoStatus?.isMoving || false}
              autoRock={servoStatus?.autoRock || false}
              onMoveLeft={handleMoveLeft}
              onMoveRight={handleMoveRight}
              onStop={handleStop}
              onToggleAutoRock={handleToggleAutoRock}
              onEmergencyStop={handleEmergencyStop}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {settings && (
              <SettingsPanel
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onReconnect={handleReconnect}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={handleEmergencyStop}
          className="w-14 h-14 bg-indigo-500 hover:bg-indigo-600 rounded-full shadow-lg flex items-center justify-center"
        >
          <Baby className="h-6 w-6 text-white" />
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
        />
      ))}
    </div>
  );
}