import { useEffect } from "react";
import { X, AlertTriangle, Info, AlertCircle, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationToastProps {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  onDismiss: () => void;
  duration?: number;
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
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getBorderColor = () => {
    switch (severity) {
      case 'warning':
        return 'border-amber-500/50 shadow-amber-500/10';
      case 'error':
        return 'border-destructive/50 shadow-destructive/10';
      default:
        return 'border-primary/50 shadow-primary/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9, x: "-50%" }}
      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md",
        "bg-background/80 backdrop-blur-2xl border-2 rounded-[2rem] p-5 shadow-2xl transition-all",
        getBorderColor()
      )}
    >
      <div className="flex items-start space-x-4">
        <div className={cn(
          "p-3 rounded-2xl shrink-0",
          severity === 'warning' ? "bg-amber-500/10" : 
          severity === 'error' ? "bg-destructive/10" : "bg-primary/10"
        )}>
          {getIcon()}
        </div>
        
        <div className="flex-1 pt-1">
          <div className="flex items-center space-x-2 mb-1">
            <BellRing className="h-3 w-3 text-muted-foreground" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">System Alert</h4>
          </div>
          <div className="font-bold text-foreground text-base tracking-tight leading-tight">{title}</div>
          <div className="text-sm font-medium text-muted-foreground mt-1 leading-relaxed">{message}</div>
        </div>

        <button 
          onClick={onDismiss}
          className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar for Duration */}
      <motion.div 
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        className={cn(
          "absolute bottom-0 left-0 h-1 rounded-full",
          severity === 'warning' ? "bg-amber-500" : 
          severity === 'error' ? "bg-destructive" : "bg-primary"
        )}
      />
    </motion.div>
  );
}
