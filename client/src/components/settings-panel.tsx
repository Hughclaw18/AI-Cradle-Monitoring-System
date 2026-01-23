import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { SystemSettings } from "@shared/schema";
import { WebcamManager } from "./webcam-manager";

interface SettingsPanelProps {
  settings: SystemSettings;
  onUpdateSettings: (settings: Partial<SystemSettings>) => void;
  onReconnect: () => void;
}

export function SettingsPanel({ settings, onUpdateSettings, onReconnect }: SettingsPanelProps) {
  const handleTempThresholdChange = (value: number[]) => {
    onUpdateSettings({ tempThreshold: value[0] });
  };

  const handleMotionSensitivityChange = (value: number[]) => {
    onUpdateSettings({ motionSensitivity: value[0] });
  };

  const getSensitivityLabel = (value: number) => {
    const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
    return labels[value - 1] || 'Medium';
  };

  return (
    <div className="space-y-4">
      {/* Camera Management */}
      <WebcamManager />

      {/* Sensor Settings */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-foreground mb-4">Sensor Settings</h3>
          
          {/* Temperature Threshold */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-foreground">Temperature Alert</label>
              <span className="text-sm text-muted-foreground">{settings.tempThreshold}°F</span>
            </div>
            <Slider
              value={[settings.tempThreshold]}
              onValueChange={handleTempThresholdChange}
              min={70}
              max={85}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>70°F</span>
              <span>85°F</span>
            </div>
          </div>

          {/* Object Sensitivity */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-foreground">Object Sensitivity</label>
              <span className="text-sm text-muted-foreground">
                {getSensitivityLabel(settings.motionSensitivity)}
              </span>
            </div>
            <Slider
              value={[settings.motionSensitivity]}
              onValueChange={handleMotionSensitivityChange}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Crying Detection Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="font-medium text-foreground">Crying Detection</div>
              <div className="text-sm text-muted-foreground">Enable audio analysis</div>
            </div>
            <Switch
              checked={settings.cryingDetectionEnabled}
              onCheckedChange={(enabled) => onUpdateSettings({ cryingDetectionEnabled: enabled })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-foreground mb-4">Automation</h3>
          <div className="space-y-3">
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Auto Response</div>
                <div className="text-sm text-muted-foreground">Respond to crying automatically</div>
              </div>
              <Switch
                checked={settings.autoResponse}
                onCheckedChange={(enabled) => onUpdateSettings({ autoResponse: enabled })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Night Mode</div>
                <div className="text-sm text-muted-foreground">Reduced sensitivity 10 PM - 6 AM</div>
              </div>
              <Switch
                checked={settings.nightMode}
                onCheckedChange={(enabled) => onUpdateSettings({ nightMode: enabled })}
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-foreground mb-4">Notifications</h3>
          <div className="space-y-3">
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Push Notifications</div>
                <div className="text-sm text-muted-foreground">Receive alerts on your device</div>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(enabled) => onUpdateSettings({ pushNotifications: enabled })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Temperature Alerts</div>
                <div className="text-sm text-muted-foreground">Alert when temperature exceeds threshold</div>
              </div>
              <Switch
                checked={settings.tempAlerts}
                onCheckedChange={(enabled) => onUpdateSettings({ tempAlerts: enabled })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Object Alerts</div>
                <div className="text-sm text-muted-foreground">Alert when object is detected</div>
              </div>
              <Switch
                checked={settings.motionAlerts}
                onCheckedChange={(enabled) => onUpdateSettings({ motionAlerts: enabled })}
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-foreground mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Device Status</span>
              <span className="text-green-600 font-medium">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Raspberry Pi IP</span>
              <span className="text-foreground font-mono text-sm">192.168.1.100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">App Version</span>
              <span className="text-foreground">v1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="text-foreground">Just now</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              onClick={onReconnect}
              className="w-full flex items-center justify-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reconnect Device</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
