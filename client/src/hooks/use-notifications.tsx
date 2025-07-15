import { useState, useEffect } from "react";

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    default: true,
  });

  useEffect(() => {
    if ("Notification" in window) {
      const currentPermission = Notification.permission;
      setPermission({
        granted: currentPermission === "granted",
        denied: currentPermission === "denied",
        default: currentPermission === "default",
      });
    }
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission({
        granted: result === "granted",
        denied: result === "denied",
        default: result === "default",
      });
      return result;
    }
    return "denied";
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if ("Notification" in window && permission.granted) {
      return new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    }
    return null;
  };

  const showAlert = (title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') => {
    const icons = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
    };

    return showNotification(title, {
      body: message,
      icon: icons[severity],
      tag: severity,
      requireInteraction: severity === 'error',
    });
  };

  return {
    permission,
    requestPermission,
    showNotification,
    showAlert,
  };
}
