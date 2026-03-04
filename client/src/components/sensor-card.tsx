import { Thermometer, Footprints, Volume2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SensorCardProps {
  type: 'temperature' | 'object' | 'crying';
  value: string;
  status: string;
  timestamp: string;
  isActive?: boolean;
  isAlert?: boolean;
  threshold?: number;
  currentValue?: number;
}

export function SensorCard({ 
  type, 
  value, 
  status, 
  timestamp, 
  isActive = true,
  isAlert = false,
  threshold,
  currentValue
}: SensorCardProps) {
  const getIcon = () => {
    switch (type) {
      case 'temperature':
        return <Thermometer className={cn("h-6 w-6 transition-colors", isAlert ? "text-destructive" : "text-primary")} />;
      case 'object':
        return <Footprints className={cn("h-6 w-6 transition-colors", isActive ? "text-green-500" : "text-muted-foreground")} />;
      case 'crying':
        return <Volume2 className={cn("h-6 w-6 transition-colors", isAlert ? "text-destructive" : "text-amber-500")} />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'temperature': return 'Temperature';
      case 'object': return 'Object Detected';
      case 'crying': return 'Audio Status';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'temperature': return 'Nursery Climate';
      case 'object': return 'Hazard Identification';
      case 'crying': return 'Crying Analysis';
    }
  };

  const getProgressWidth = () => {
    if (type === 'temperature' && currentValue && threshold) {
      const percentage = Math.min((currentValue / threshold) * 100, 100);
      return `${percentage}%`;
    }
    return '0%';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "relative overflow-hidden border-2 transition-all duration-300",
        isAlert ? "border-destructive/50 bg-destructive/5 shadow-destructive/10" : "border-border hover:border-primary/50"
      )}>
        {/* Animated background glow for alerts */}
        {isAlert && (
          <motion.div 
            className="absolute inset-0 bg-destructive/5"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        <CardContent className="p-5 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className={cn(
                "p-3 rounded-2xl shadow-sm transition-colors",
                isAlert ? "bg-destructive/10" : "bg-muted"
              )}>
                {getIcon()}
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{getTitle()}</h3>
                <p className="text-lg font-semibold text-foreground">{getSubtitle()}</p>
              </div>
            </div>
            <div className={cn(
              "flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter shadow-sm",
              isAlert ? "bg-destructive text-destructive-foreground animate-pulse" : 
              isActive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              {isAlert ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              <span>{status}</span>
            </div>
          </div>

          <div className="mt-6 flex items-baseline justify-between">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </div>
            <div className="text-xs font-medium text-muted-foreground italic">
              Updated {timestamp}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {type === 'temperature' && threshold && currentValue && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5"
              >
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: getProgressWidth() }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full transition-colors duration-500",
                      isAlert ? "bg-destructive" : "bg-primary"
                    )}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground mt-2 uppercase">
                  <span>Safe: {threshold}°F</span>
                  <span className={cn(isAlert && "text-destructive")}>{Math.round(currentValue)}°F Current</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(type === 'object' || type === 'crying') && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-2 mt-5 p-2 rounded-lg bg-muted/50"
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-muted-foreground/30'
              )} />
              <span className="text-xs font-medium text-muted-foreground">
                {isActive ? 'Monitoring active' : 'Sensor on standby'}
              </span>
            </motion.div>
          )}

          {isAlert && type === 'crying' && (
            <motion.div 
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mt-4 shadow-inner"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <Volume2 className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-destructive uppercase leading-tight">Emergency Response</p>
                  <p className="text-sm font-medium text-destructive/80 leading-tight">Automated Lullaby Active</p>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
