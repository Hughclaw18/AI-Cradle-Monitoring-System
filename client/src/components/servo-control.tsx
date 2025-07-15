import { useState } from "react";
import { ArrowLeft, ArrowRight, Square, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ServoControlProps {
  position: number;
  isMoving: boolean;
  autoRock: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onStop: () => void;
  onToggleAutoRock: (enabled: boolean) => void;
  onEmergencyStop: () => void;
}

export function ServoControl({
  position,
  isMoving,
  autoRock,
  onMoveLeft,
  onMoveRight,
  onStop,
  onToggleAutoRock,
  onEmergencyStop
}: ServoControlProps) {
  const getPositionPercentage = () => {
    return (position / 180) * 100;
  };

  return (
    <div className="space-y-4">
      {/* Servo Control */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-800">Cradle Control</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-600">Connected</span>
            </div>
          </div>
          
          {/* Position Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-gray-800">{position}°</div>
              <div className="text-sm text-gray-500">Current Position</div>
            </div>
            <div className="bg-gray-200 rounded-full h-3 relative">
              <div 
                className="bg-indigo-500 h-3 rounded-full transition-all duration-500" 
                style={{ width: `${getPositionPercentage()}%` }}
              />
              <div 
                className="absolute top-0 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -mt-0.5 transition-all duration-500"
                style={{ left: `calc(${getPositionPercentage()}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0°</span>
              <span>180°</span>
            </div>
          </div>

          {/* Manual Control Buttons */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button
              variant="outline"
              onClick={onMoveLeft}
              disabled={autoRock}
              className="flex flex-col items-center justify-center h-16 space-y-1"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600">Left</span>
            </Button>
            
            <Button
              variant="destructive"
              onClick={onStop}
              className="flex flex-col items-center justify-center h-16 space-y-1"
            >
              <Square className="h-5 w-5" />
              <span className="text-xs">Stop</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={onMoveRight}
              disabled={autoRock}
              className="flex flex-col items-center justify-center h-16 space-y-1"
            >
              <ArrowRight className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600">Right</span>
            </Button>
          </div>

          {/* Auto Rock Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-800">Auto Rock</div>
              <div className="text-sm text-gray-500">Gentle continuous rocking</div>
            </div>
            <Switch
              checked={autoRock}
              onCheckedChange={onToggleAutoRock}
            />
          </div>

          {isMoving && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <RotateCcw className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-800">
                  {autoRock ? 'Auto rocking in progress...' : 'Manual control active...'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Controls */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-800 mb-4">System Controls</h3>
          <div className="space-y-3">
            <Button
              variant="destructive"
              onClick={onEmergencyStop}
              className="w-full flex items-center justify-center space-x-2"
            >
              <Square className="h-4 w-4" />
              <span>Emergency Stop All</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
