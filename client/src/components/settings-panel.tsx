import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, MessageSquare, CheckCircle2, XCircle, Send, Loader2 } from "lucide-react";
import { SystemSettings } from "@shared/schema";
import { WebcamManager } from "./webcam-manager";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface SmsStatus {
  sms: { configured: boolean; clientReady: boolean; usingMessagingService: boolean; fromConfigured: boolean };
  targetPhone: string | null;
  pushNotifications: boolean;
}

function SmsStatusCard() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SmsStatus>({
    queryKey: ["/api/notifications/status"],
    staleTime: 60_000,
  });

  const testSmsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/test-sms"),
    onSuccess: () => toast({ title: "Test SMS sent", description: `Message sent to ${data?.targetPhone ?? "your number"}.` }),
    onError: (e: Error) => toast({ title: "Couldn't send test SMS", description: e.message, variant: "destructive" }),
  });

  const configured = data?.sms?.configured ?? false;
  const phone = data?.targetPhone;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">SMS Alerts (Twilio)</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
          </div>
        ) : (
          <div className="space-y-2">
            {/* Configured status */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Twilio</span>
              <div className="flex items-center gap-1.5">
                {configured
                  ? <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-xs text-green-600 font-bold">Ready</span></>
                  : <><XCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-destructive font-bold">Not configured</span></>
                }
              </div>
            </div>

            {/* Target phone */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Alerts sent to</span>
              <span className="text-xs font-mono text-muted-foreground">
                {phone ?? <span className="text-destructive">No phone on profile</span>}
              </span>
            </div>

            {/* Push notifications toggle status */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">SMS enabled</span>
              {data?.pushNotifications
                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                : <XCircle className="h-4 w-4 text-muted-foreground" />
              }
            </div>

            {/* Test button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-xl"
              disabled={!configured || !phone || testSmsMutation.isPending}
              onClick={() => testSmsMutation.mutate()}
            >
              {testSmsMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
              Send test SMS
            </Button>

            {!phone && (
              <p className="text-[11px] text-muted-foreground text-center">
                Add a phone number to your profile to receive SMS alerts.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Camera Management */}
        <WebcamManager />
        
        {/* Local Camera Settings */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground mb-4">Camera Settings</h3>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium text-foreground">Enable Local Camera</div>
                <div className="text-sm text-muted-foreground">Allow use of device webcam</div>
              </div>
              <Switch
                checked={settings.enableLocalWebcam}
                onCheckedChange={(enabled) => onUpdateSettings({ enableLocalWebcam: enabled })}
              />
            </div>
          </CardContent>
        </Card>

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
      </div>

      <div className="space-y-4">
        {/* Automation Settings */}
        <Accordion type="multiple" defaultValue={["automation", "notifications"]} className="w-full">
          <AccordionItem value="automation">
            <AccordionTrigger>
              <h3 className="font-medium text-foreground">Automation Settings</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="shadow-none border-none">
                <CardContent className="p-0">
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
            </AccordionContent>
          </AccordionItem>

          {/* Notification Settings */}
          <AccordionItem value="notifications">
            <AccordionTrigger>
              <h3 className="font-medium text-foreground">Notification Settings</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="shadow-none border-none">
                <CardContent className="p-0">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* SMS / Twilio Status */}
        <SmsStatusCard />

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
                <span className="text-muted-foreground text-xs md:text-sm">Hosted on Render at</span>
                <span className="text-foreground font-mono text-[10px] md:text-sm">https://smartcradlemonitor.onrender.com/</span>
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
    </div>
  );
}
