import WebSocket from 'ws';

const room = process.argv[2] || 'doc-2';
const token = process.argv[3];
if (!token) {
  console.error('Usage: node test-yjs-conn.mjs <room> <token>');
  process.exit(1);
}

const url = `ws://localhost:4000/yjs/${encodeURIComponent(room)}?token=${encodeURIComponent(token)}`;
console.log('Connecting to', url);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('OPEN');
  setTimeout(() => {
    console.log('Closing after 2s');
    ws.close(1000, 'test-done');
  }, 2000);
});

ws.on('unexpected-response', (req, res) => {
  console.error('Unexpected response statusCode=', res.statusCode);
});

ws.on('close', (code, reason) => {
  console.log('CLOSE', code, reason && reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('ERROR', err && err.message);
  process.exit(1);
});
