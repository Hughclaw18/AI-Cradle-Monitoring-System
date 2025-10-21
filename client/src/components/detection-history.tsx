import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorData } from "@shared/schema";
import { format } from 'date-fns';

interface DetectionHistoryProps {
  sensorData: SensorData | null;
}

interface DetectionEvent {
  type: 'crying' | 'object';
  timestamp: Date;
  details?: string;
}

export const DetectionHistory: React.FC<DetectionHistoryProps> = ({ sensorData }) => {
  const [detections, setDetections] = React.useState<DetectionEvent[]>([]);

  React.useEffect(() => {
    if (sensorData) {
      const newDetections: DetectionEvent[] = [];

      if (sensorData.cryingDetected) {
        newDetections.push({
          type: 'crying',
          timestamp: new Date(sensorData.timestamp),
          details: 'Crying detected',
        });
      }

      if (sensorData.objectDetected && sensorData.objectDetected.length > 0) {
        sensorData.objectDetected.forEach(obj => {
          newDetections.push({
            type: 'object',
            timestamp: new Date(obj.timestamp),
            details: `Object detected: ${obj.object_name}`,
          });
        });
      }

      if (newDetections.length > 0) {
        setDetections(prevDetections => {
          // Filter out duplicates based on type and timestamp to avoid adding the same event multiple times
          const uniqueNewDetections = newDetections.filter(
            newDet => !prevDetections.some(
              prevDet => prevDet.type === newDet.type && prevDet.timestamp.getTime() === newDet.timestamp.getTime()
            )
          );
          return [...prevDetections, ...uniqueNewDetections].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        });
      }
    }
  }, [sensorData]);

  const cryingDetections = detections.filter(det => det.type === 'crying');
  const objectDetections = detections.filter(det => det.type === 'object');

  const renderDetectionList = (list: DetectionEvent[]) => (
    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
      {list.length === 0 ? (
        <p className="text-center text-gray-500">No detections of this type yet.</p>
      ) : (
        list.map((detection, index) => (
          <div key={index} className="mb-2 pb-2 border-b last:border-b-0">
            <p className="text-sm font-medium">{detection.details}</p>
            <p className="text-xs text-gray-500">{format(detection.timestamp, 'PPP p')}</p>
          </div>
        ))
      )}
    </ScrollArea>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detection History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Detections</TabsTrigger>
            <TabsTrigger value="crying">Crying</TabsTrigger>
            <TabsTrigger value="object">Object</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {renderDetectionList(detections)}
          </TabsContent>
          <TabsContent value="crying" className="mt-4">
            {renderDetectionList(cryingDetections)}
          </TabsContent>
          <TabsContent value="object" className="mt-4">
            {renderDetectionList(objectDetections)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};