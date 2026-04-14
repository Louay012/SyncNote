#!/usr/bin/env node

// Smoke test variant that does NOT query the DB.
// Provide a document id as first arg, otherwise default to '3'.

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import * as Y from 'yjs';
const ywsMod = await import('y-websocket');
const WebsocketProvider = ywsMod.WebsocketProvider || ywsMod.default?.WebsocketProvider || ywsMod.default || ywsMod;

const docId = process.argv[2] || '3';
const wsUrl = 'ws://localhost:4000/yjs';
const room = `doc-${docId}`;

console.log('Smoke test (no-DB):', `${wsUrl} room=${room}`);

const docA = new Y.Doc();
const docB = new Y.Doc();

const providerA = new WebsocketProvider(wsUrl, room, docA);
const providerB = new WebsocketProvider(wsUrl, room, docB);

providerA.on('status', (ev) => console.log('providerA status', ev.status));
providerB.on('status', (ev) => console.log('providerB status', ev.status));
providerA.on('sync', (isSynced) => console.log('providerA sync', isSynced));
providerB.on('sync', (isSynced) => console.log('providerB sync', isSynced));

const waitFor = (doc, predicate, ms = 10000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const handler = () => {
    try {
      if (predicate()) {
        doc.off('update', handler);
        return resolve();
      }
    } catch (e) {}
    if (Date.now() - start > ms) {
      doc.off('update', handler);
      return reject(new Error('timeout waiting for condition'));
    }
  };
  doc.on('update', handler);
  handler();
});

(async () => {
  try {
    console.log('Waiting a moment for providers to connect...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const textA = docA.getText('content');
    const textB = docB.getText('content');

    textA.insert(0, 'Hello from A');
    try {
      await waitFor(docB, () => textB.toString().includes('Hello from A'), 8000);
      console.log('docB saw A ->', textB.toString());
    } catch (e) {
      console.error('docB did not observe A update:', e.message || e);
    }

    textB.insert(textB.toString().length, ' Hello from B');
    try {
      await waitFor(docA, () => textA.toString().includes('Hello from B'), 8000);
      console.log('docA saw B ->', textA.toString());
    } catch (e) {
      console.error('docA did not observe B update:', e.message || e);
    }

    console.log('Done — cleaning up');
  } catch (err) {
    console.error('Smoke test error:', err && (err.stack || err));
  } finally {
    try { providerA.destroy(); } catch (e) {}
    try { providerB.destroy(); } catch (e) {}
    try { docA.destroy(); } catch (e) {}
    try { docB.destroy(); } catch (e) {}
    process.exit(0);
  }
})();
