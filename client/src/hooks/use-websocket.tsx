import { useState, useEffect, useRef } from "react";
import { SensorData, ServoStatus, MusicStatus, SystemSettings } from "@shared/schema";

export interface WebSocketMessage {
  type: 'initial_data' | 'sensor_update' | 'servo_update' | 'music_update' | 'notification' | 'settings_update' | 'video_frame';
  data: any;
}

export interface NotificationData {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface InitialData {
  sensors: SensorData;
  servo: ServoStatus;
  music: MusicStatus;
  settings: SystemSettings;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [servoStatus, setServoStatus] = useState<ServoStatus | null>(null);
  const [musicStatus, setMusicStatus] = useState<MusicStatus | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/socket`;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'initial_data':
              const data = message.data as InitialData;
              setSensorData(data.sensors);
              setServoStatus(data.servo);
              setMusicStatus(data.music);
              setSettings(data.settings);
              break;
              
            case 'sensor_update':
              setSensorData(message.data as SensorData);
              break;
              
            case 'servo_update':
              setServoStatus(message.data as ServoStatus);
              break;
              
            case 'music_update':
              setMusicStatus(message.data as MusicStatus);
              break;

            case 'settings_update':
              setSettings(message.data as SystemSettings);
              break;
              
            case 'notification':
              const notification = message.data as NotificationData;
              setNotifications(prev => [...prev, notification]);
              break;

            case 'video_frame':
              setVideoFrame(message.data as string);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const dismissNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    connected,
    sensorData,
    servoStatus,
    musicStatus,
    settings,
    notifications,
    videoFrame,
    dismissNotification,
    clearAllNotifications,
  };
}
