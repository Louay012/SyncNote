const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:4000/yjs/doc-2';
console.log('connecting to', url);
const ws = new WebSocket(url);
ws.on('open', () => {
  console.log('open');
});
ws.on('message', (msg) => {
  console.log('message:', msg && msg.toString());
});
ws.on('close', (code, reason) => {
  console.log('close', code, reason && reason.toString());
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('error', err && (err.stack || err));
  process.exit(1);
});

// timeout to close
setTimeout(() => {
  try { ws.close(); } catch (e) {}
}, 5000);
