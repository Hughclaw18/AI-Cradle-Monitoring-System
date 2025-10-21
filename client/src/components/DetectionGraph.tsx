import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DetectionEvent {
  type: 'crying' | 'object';
  timestamp: Date;
  details?: string;
}

interface DetectionGraphProps {
  detections: DetectionEvent[];
}

const DetectionGraph: React.FC<DetectionGraphProps> = ({ detections }) => {
  // Aggregate data by hour or day for the graph
  const aggregatedData = detections.reduce((acc: { [key: string]: { timestamp: Date; crying: number; object: number } }, detection) => {
    const dateKey = format(detection.timestamp, 'yyyy-MM-dd HH'); // Aggregate by hour
    if (!acc[dateKey]) {
      acc[dateKey] = { timestamp: new Date(dateKey), crying: 0, object: 0 };
    }
    if (detection.type === 'crying') {
      acc[dateKey].crying += 1;
    } else if (detection.type === 'object') {
      acc[dateKey].object += 1;
    }
    return acc;
  }, {});

  const data = Object.values(aggregatedData).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" tickFormatter={(tick) => format(new Date(tick), 'HH:mm')}/>
        <YAxis />
        <Tooltip labelFormatter={(label) => format(new Date(label), 'PPP p')}/>
        <Legend />
        <Line type="monotone" dataKey="crying" stroke="#8884d8" activeDot={{ r: 8 }} />
        <Line type="monotone" dataKey="object" stroke="#82ca9d" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default DetectionGraph;