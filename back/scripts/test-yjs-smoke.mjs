#!/usr/bin/env node

// Smoke test (backend context): two headless Yjs clients connect to local y-websocket
// server and verify bidirectional sync of a shared `content` Y.Text.

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import * as Y from 'yjs';

const ywsMod = await import('y-websocket');
const WebsocketProvider = ywsMod.WebsocketProvider || ywsMod.default?.WebsocketProvider || ywsMod.default || ywsMod;

// DB helper to find a public document id
import { query as dbQuery } from '../src/db/postgres.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function findDocId() {
  try {
    const res = await dbQuery('SELECT id FROM documents WHERE is_public = true LIMIT 1');
    if (res && res.rows && res.rows[0]) return res.rows[0].id;
    const res2 = await dbQuery('SELECT id FROM documents LIMIT 1');
    if (res2 && res2.rows && res2.rows[0]) return res2.rows[0].id;
  } catch (e) {
    console.error('DB query failed:', e.message || e);
  }
  return null;
}

async function main() {
  const docId = (await findDocId()) || process.argv[2];
  if (!docId) {
    console.error('\nNo document id found. Ensure your DB is seeded or pass a doc id as the first argument.');
    console.error('Example: node back/scripts/test-yjs-smoke.mjs 3');
    process.exit(1);
  }

  const wsUrl = 'ws://localhost:4000/yjs';
  const room = `doc-${docId}`;
  console.log('Smoke test: connecting two headless clients to', `${wsUrl} (room=${room})`);

  const docA = new Y.Doc();
  const docB = new Y.Doc();

  const opts = {};
  const providerA = new WebsocketProvider(wsUrl, room, docA, opts);
  const providerB = new WebsocketProvider(wsUrl, room, docB, opts);

  providerA.on('status', (ev) => console.log('providerA status', ev.status));
  providerB.on('status', (ev) => console.log('providerB status', ev.status));
  providerA.on('sync', (isSynced) => console.log('providerA sync', isSynced));
  providerB.on('sync', (isSynced) => console.log('providerB sync', isSynced));

  const start = Date.now();
  const timeoutMs = 15000;

  await new Promise((resolve, reject) => {
    let aReady = false;
    let bReady = false;
    function check() {
      if (aReady && bReady) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('providers failed to become ready in time'));
    }
    providerA.on('sync', (isSynced) => { if (isSynced) { aReady = true; check(); }});
    providerB.on('sync', (isSynced) => { if (isSynced) { bReady = true; check(); }});
    providerA.on('status', (ev) => { if (ev.status === 'connected') { aReady = true; check(); }});
    providerB.on('status', (ev) => { if (ev.status === 'connected') { bReady = true; check(); }});
    setTimeout(check, 1000);
  });

  console.log('Providers ready — performing edits');

  const textA = docA.getText('content');
  const textB = docB.getText('content');

  // wait helper
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

  textA.insert(0, 'Hello from A');
  await waitFor(docB, () => textB.toString().includes('Hello from A'));
  console.log('docB saw A ->', textB.toString());

  textB.insert(textB.toString().length, ' Hello from B');
  await waitFor(docA, () => textA.toString().includes('Hello from B'));
  console.log('docA saw B ->', textA.toString());

  console.log('\nSmoke test passed — edits synchronized both ways.');

  try { providerA.destroy(); } catch (e) {}
  try { providerB.destroy(); } catch (e) {}
  try { docA.destroy(); } catch (e) {}
  try { docB.destroy(); } catch (e) {}
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test failed:', err && (err.stack || err));
  process.exit(2);
});
