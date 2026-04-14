const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:4000/yjs/doc-2?token=';
console.log('Connecting to', url);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('OPEN');
  ws.send('hello');
});

ws.on('close', (code, reason) => {
  console.log('CLOSE', code, reason && reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('ERROR', err.message);
  process.exit(1);
});

ws.on('message', (data) => {
  console.log('MSG', data.toString());
});
