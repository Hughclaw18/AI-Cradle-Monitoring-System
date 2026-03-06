import { useState, useEffect } from "react";
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

let sharedWs: WebSocket | null = null;
let sharedUrl: string | null = null;
let refCount = 0;

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [servoStatus, setServoStatus] = useState<ServoStatus | null>(null);
  const [musicStatus, setMusicStatus] = useState<MusicStatus | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [videoFrame, setVideoFrame] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/socket`;
    const ensureConnection = () => {
      if (!sharedWs || sharedWs.readyState === WebSocket.CLOSED || sharedWs.readyState === WebSocket.CLOSING || sharedUrl !== wsUrl) {
        sharedWs = new WebSocket(wsUrl);
        sharedUrl = wsUrl;
      }
    };

    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
      // Auto-reconnect if there are active consumers
      if (refCount > 0) {
        setTimeout(() => {
          if (refCount > 0) {
            ensureConnection();
            if (sharedWs) {
              const ws2 = sharedWs;
              ws2.addEventListener('open', onOpen);
              ws2.addEventListener('close', onClose);
              ws2.addEventListener('error', onError as any);
              ws2.addEventListener('message', onMessage as any);
            }
          }
        }, 3000);
      }
    };

    const onError = () => {
      setConnected(false);
    };

    const onMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'initial_data': {
            const data = message.data as InitialData;
            setSensorData(data.sensors);
            setServoStatus(data.servo);
            setMusicStatus(data.music);
            setSettings(data.settings);
            break;
          }
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
          case 'notification': {
            const notification = message.data as NotificationData;
            setNotifications(prev => [...prev, notification]);
            break;
          }
          case 'video_frame':
            setVideoFrame(message.data as string);
            break;
        }
      } catch {
      }
    };

    ensureConnection();
    refCount += 1;
    const ws = sharedWs!;
    ws.addEventListener('open', onOpen);
    ws.addEventListener('close', onClose);
    ws.addEventListener('error', onError as any);
    ws.addEventListener('message', onMessage as any);

    const beforeUnload = () => {
      if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
        try {
          sharedWs.close();
        } catch {}
        sharedWs = null;
        sharedUrl = null;
      }
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      if (!sharedWs) return;
      sharedWs.removeEventListener('open', onOpen);
      sharedWs.removeEventListener('close', onClose);
      sharedWs.removeEventListener('error', onError as any);
      sharedWs.removeEventListener('message', onMessage as any);
      window.removeEventListener('beforeunload', beforeUnload);
      refCount = Math.max(0, refCount - 1);
      // Do not auto-close here; keep connection for app lifetime
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
