import { WebSocket } from 'ws';

const url = process.env.WS_URL || 'wss://ai-cradle-monitoring-system.onrender.com/socket';
const token = process.env.SIM_TKN || 'default-simulator-token';

console.log('Connecting to', url);
const ws = new WebSocket(url, {
  headers: { 'x-simulator-token': token },
});

ws.on('open', () => {
  console.log('WS connected');
  ws.close();
});

ws.on('close', (code, reason) => {
  console.log('WS closed', code, String(reason || ''));
});

ws.on('error', (e) => {
  console.error('WS error', e?.message || e);
});
