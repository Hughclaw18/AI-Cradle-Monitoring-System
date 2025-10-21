import { Thermometer, Footprints, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
        return <Thermometer className="h-6 w-6 text-blue-600" />;
      case 'object':
        return <Footprints className="h-6 w-6 text-green-600" />;
      case 'crying':
        return <Volume2 className="h-6 w-6 text-amber-600" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'temperature':
        return 'Temperature';
      case 'object':
        return 'Object Detection';
      case 'crying':
        return 'Crying Detection';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'temperature':
        return 'Room temperature';
      case 'object':
        return 'Object sensor';
      case 'crying':
        return 'Sound analysis';
    }
  };

  const getStatusColor = () => {
    if (isAlert) return 'text-amber-600';
    if (type === 'object' || type === 'crying') {
      return isActive ? 'text-green-600' : 'text-gray-500';
    }
    return 'text-green-600';
  };

  const getProgressWidth = () => {
    if (type === 'temperature' && currentValue && threshold) {
      const percentage = Math.min((currentValue / threshold) * 100, 100);
      return `${percentage}%`;
    }
    return '0%';
  };

  return (
    <Card className={cn(
      "relative",
      isAlert && "border-amber-400 bg-amber-50"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-full">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{getTitle()}</h3>
              <p className="text-sm text-gray-500">{getSubtitle()}</p>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            isAlert ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
          )}>
            {status}
          </div>
        </div>

        <div className="mt-4 text-2xl font-bold text-gray-900">
          {value}
        </div>

        {type === 'temperature' && threshold && currentValue && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: getProgressWidth() }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0°F</span>
              <span>{threshold}°F Threshold</span>
            </div>
          </div>
        )}

        {(type === 'object' || type === 'crying') && (
          <div className="flex items-center space-x-2 mt-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isActive ? 'bg-green-500' : 'bg-gray-300'
            )} />
            <span className="text-sm text-gray-600">
              {isActive ? 'Sensor active' : 'Sensor inactive'}
            </span>
          </div>
        )}

        {isAlert && type === 'crying' && (
          <div className="bg-amber-50 rounded-lg p-3 mt-3">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">
                Baby is crying - Music started
              </span>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-2">
          Last update: {timestamp}
        </div>
      </CardContent>
    </Card>
  );
}
