import { useState } from "react";
import { Thermometer, Footprints, Volume2, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { pulsingOpacity, fadeInSlideLeft } from "@/lib/animations";

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
  type, value, status, timestamp,
  isActive = true, isAlert = false,
  threshold, currentValue,
}: SensorCardProps) {
  const [open, setOpen] = useState(false);

  const META = {
    temperature: { title: "Temperature",    subtitle: "Nursery Climate",      Icon: Thermometer },
    object:      { title: "Object Detected", subtitle: "Hazard Identification", Icon: Footprints  },
    crying:      { title: "Audio Status",    subtitle: "Crying Analysis",       Icon: Volume2     },
  }[type];

  const iconColor =
    type === "temperature" ? (isAlert ? "text-destructive" : "text-primary")
    : type === "object"    ? (isActive ? "text-green-500" : "text-muted-foreground")
    :                        (isAlert ? "text-destructive" : "text-amber-500");

  const progressPct = type === "temperature" && currentValue && threshold
    ? Math.min((currentValue / threshold) * 100, 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border-2 overflow-hidden transition-all duration-200 cursor-pointer select-none",
        isAlert
          ? "border-destructive/50 bg-destructive/5"
          : "border-border hover:border-primary/40 bg-card"
      )}
      onClick={() => setOpen(o => !o)}
    >
      {/* Alert pulse background */}
      {isAlert && (
        <motion.div className="absolute inset-0 bg-destructive/5 pointer-events-none" variants={pulsingOpacity} animate="animate" />
      )}

      {/* ── Collapsed row ── */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className={cn("p-2 rounded-xl shrink-0", isAlert ? "bg-destructive/10" : "bg-muted")}>
          <META.Icon className={cn("h-4 w-4", iconColor)} />
        </div>

        {/* Title + value */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">{META.title}</p>
          <p className="text-base font-bold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        </div>

        {/* Status badge */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shrink-0",
          isAlert
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : isActive
              ? "bg-green-500/10 text-green-600"
              : "bg-muted text-muted-foreground"
        )}>
          {isAlert ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          <span>{status === 'Secure' ? 'Clear' : status === 'Quiet' ? 'Silent' : status === 'Stable' ? 'Normal' : status}</span>
        </div>

        {/* Chevron */}
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </div>

      {/* ── Expanded detail ── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3 relative z-10">

              {/* Subtitle + timestamp */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">{META.subtitle}</p>
                <p className="text-[10px] text-muted-foreground italic">Updated {timestamp}</p>
              </div>

              {/* Temperature progress bar */}
              {type === "temperature" && threshold && currentValue && (
                <div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={cn("h-full rounded-full", isAlert ? "bg-destructive" : "bg-primary")}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground mt-1.5 uppercase">
                    <span>Threshold: {threshold}°F</span>
                    <span className={cn(isAlert && "text-destructive")}>{Math.round(currentValue)}°F now</span>
                  </div>
                </div>
              )}

              {/* Object / crying monitoring status */}
              {(type === "object" || type === "crying") && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30"
                  )} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {isActive ? "Monitoring active" : "Sensor on standby"}
                  </span>
                </div>
              )}

              {/* Crying emergency response */}
              {isAlert && type === "crying" && (
                <motion.div variants={fadeInSlideLeft} initial="initial" animate="animate"
                  className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-destructive/20 rounded-lg">
                      <Volume2 className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-destructive uppercase">Emergency Response</p>
                      <p className="text-xs font-medium text-destructive/80">Automated Lullaby Active</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
