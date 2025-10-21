import { useEffect } from "react";
import { X, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationToastProps {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  onDismiss: () => void;
  duration?: number; // Add duration prop
}

export function NotificationToast({ title, message, severity, onDismiss, duration = 5000 }: NotificationToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const getIcon = () => {
    switch (severity) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-white" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-white" />;
      default:
        return <Info className="h-5 w-5 text-white" />;
    }
  };

  const getBgColor = () => {
    switch (severity) {
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm w-full mx-4 z-50 animate-in slide-in-from-top-5">
      <div className="flex items-center space-x-3">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", getBgColor())}>
          {getIcon()}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-800">{title}</div>
          <div className="text-sm text-gray-600">{message}</div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
