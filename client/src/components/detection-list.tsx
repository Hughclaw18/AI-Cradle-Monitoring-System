import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeInSlideLeft, expandCollapseHeight } from "@/lib/animations"; // Import variants

interface DetectionEvent {
  type: 'crying' | 'object' | 'temperature';
  timestamp: Date;
  details?: string;
}

interface DetectionLogItemProps {
  entry: DetectionEvent;
  index: number;
}

const DetectionLogItem: React.FC<DetectionLogItemProps> = ({ entry, index }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  let iconColorClass = "";
  let bgColorClass = "";
  let borderColorClass = "";

  switch (entry.type) {
    case 'crying':
      iconColorClass = "text-amber-500";
      bgColorClass = "bg-amber-500/5";
      borderColorClass = "border-amber-500/10";
      break;
    case 'object':
      iconColorClass = "text-green-500";
      bgColorClass = "bg-green-500/5";
      borderColorClass = "border-green-500/10";
      break;
    case 'temperature':
      iconColorClass = "text-destructive";
      bgColorClass = "bg-destructive/5";
      borderColorClass = "border-destructive/10";
      break;
    default:
      iconColorClass = "text-muted-foreground";
      bgColorClass = "bg-muted/5";
      borderColorClass = "border-muted/10";
  }

  return (
    <motion.div 
      variants={fadeInSlideLeft} // Use fadeInSlideLeft variant
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.05 }} // Keep delay for staggered effect
      className={cn(
        "p-3 rounded-2xl border hover:bg-muted/50 transition-colors",
        bgColorClass,
        borderColorClass
      )}
    >
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <p className="text-sm font-semibold text-foreground leading-tight">
          {entry.type === 'temperature' ? 'Temperature Alert' : `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Detection`}
        </p>
        <div className="flex items-center space-x-2">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", iconColorClass)}>
            {format(new Date(entry.timestamp), 'p')}
          </span>
          <span className={cn("text-[10px] font-bold uppercase tracking-widest", iconColorClass)}>
            {format(new Date(entry.timestamp), 'MMM d')}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", iconColorClass, { 'rotate-180': isExpanded })} />
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            variants={expandCollapseHeight} // Use expandCollapseHeight variant
            initial="initial"
            animate="animate"
            exit="exit"
            className="pt-2 border-t mt-2"
          >
            <p className="text-xs text-muted-foreground">Details: {entry.details || 'No additional details available.'}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface DetectionListProps {
  detections: DetectionEvent[];
  emptyMessage: string;
}

export const DetectionList: React.FC<DetectionListProps> = ({ detections, emptyMessage }) => {
  return (
    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
      {detections.length === 0 ? (
        <p className="text-center text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {detections.map((detection, index) => (
            <DetectionLogItem key={index} entry={detection} index={index} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
};
