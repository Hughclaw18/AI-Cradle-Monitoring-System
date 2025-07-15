import { Thermometer, Footprints, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SensorCardProps {
  type: 'temperature' | 'motion' | 'crying';
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
      case 'motion':
        return <Footprints className="h-6 w-6 text-green-600" />;
      case 'crying':
        return <Volume2 className="h-6 w-6 text-amber-600" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'temperature':
        return 'Temperature';
      case 'motion':
        return 'Motion Detection';
      case 'crying':
        return 'Crying Detection';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'temperature':
        return 'Room temperature';
      case 'motion':
        return 'Movement sensor';
      case 'crying':
        return 'Sound analysis';
    }
  };

  const getStatusColor = () => {
    if (isAlert) return 'text-amber-600';
    if (type === 'motion' || type === 'crying') {
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
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              type === 'temperature' ? 'bg-blue-100' : 
              type === 'motion' ? 'bg-green-100' : 'bg-amber-100'
            )}>
              {getIcon()}
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{getTitle()}</h3>
              <p className="text-xs text-gray-500">{getSubtitle()}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className={cn("text-xs", getStatusColor())}>{status}</div>
          </div>
        </div>

        {type === 'temperature' && threshold && currentValue && (
          <>
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: getProgressWidth() }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>60°F</span>
              <span>{threshold}°F</span>
            </div>
          </>
        )}

        {(type === 'motion' || type === 'crying') && (
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
