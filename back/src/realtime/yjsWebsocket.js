import { WebSocketServer } from "ws";
import { getUserIdFromAuthHeader } from "../utils/auth.js";
import { canAccessDocument } from "../utils/permissions.js";
import * as Y from "yjs";
import { query as dbQuery } from "../db/postgres.js";
import Document from "../models/Document.js";

let _setupWSConnection = null;
let _setupWSModule = null;
async function resolveSetupWSConnection() {
  if (_setupWSConnection) return _setupWSConnection;

  const tryImport = async (path) => {
    try {
      const mod = await import(path);
      if (mod && (mod.setupWSConnection || (mod.default && mod.default.setupWSConnection))) {
        return mod.setupWSConnection || mod.default.setupWSConnection;
      }
    } catch (e) {
      // import failed
    }
    return null;
  };

  // Common candidate paths (cover variations across package versions)
  const candidates = [
    "y-websocket/bin/utils",
    "y-websocket/bin/utils.js",
    "y-websocket/bin/utils.cjs",
    "y-websocket/dist/bin/utils.js",
    "y-websocket/dist/bin/utils.cjs"
  ];

  for (const p of candidates) {
    const fn = await tryImport(p);
    if (fn) {
      _setupWSConnection = fn;
      return _setupWSConnection;
    }
  }
  // Try importing the package main entry (ESM) and locate `setupWSConnection`.
    try {
        try {
          const yws = await import("y-websocket");
        // Determine module object that contains the helper functions
        const modToUse = (yws && (yws.default || yws)) || yws;
        if (modToUse && (modToUse.setupWSConnection || (modToUse.default && modToUse.default.setupWSConnection))) {
          _setupWSModule = modToUse;
          _setupWSConnection = modToUse.setupWSConnection || (modToUse.default && modToUse.default.setupWSConnection) || _setupWSConnection;
          return _setupWSConnection;
        }

        // try to find a candidate function on the imported module
        for (const k of Object.keys(yws)) {
          const v = yws[k];
          if (typeof v === "function" && (v.name === "setupWSConnection" || k.toLowerCase().includes("setup"))) {
            _setupWSModule = yws;
            _setupWSConnection = v;
            return _setupWSConnection;
          }
        }
      } catch (e) {
        // import('y-websocket') failed
      }

    // Try requiring the package (CommonJS) - this will load the package's main
    // entry as defined by Node resolution and package.json exports.
      try {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const ywsReq = require("y-websocket");
        const modReqToUse = (ywsReq && (ywsReq.default || ywsReq)) || ywsReq;
        if (modReqToUse && (modReqToUse.setupWSConnection || (modReqToUse.default && modReqToUse.default.setupWSConnection))) {
          _setupWSModule = modReqToUse;
          _setupWSConnection = modReqToUse.setupWSConnection || (modReqToUse.default && modReqToUse.default.setupWSConnection) || _setupWSConnection;
          return _setupWSConnection;
        }

        for (const k of Object.keys(ywsReq || {})) {
          const v = ywsReq[k];
          if (typeof v === "function" && (v.name === "setupWSConnection" || k.toLowerCase().includes("setup"))) {
            _setupWSModule = ywsReq;
            _setupWSConnection = v;
            return _setupWSConnection;
          }
        }

      // As a last attempt, try resolving the package main file explicitly
        try {
        const mainResolved = require.resolve("y-websocket");
        const mainMod = require(mainResolved);
        const mainModToUse = (mainMod && (mainMod.default || mainMod)) || mainMod;
        if (mainModToUse && (mainModToUse.setupWSConnection || (mainModToUse.default && mainModToUse.default.setupWSConnection))) {
          _setupWSModule = mainModToUse;
          _setupWSConnection = mainModToUse.setupWSConnection || (mainModToUse.default && mainModToUse.default.setupWSConnection) || _setupWSConnection;
          return _setupWSConnection;
        }
        for (const k of Object.keys(mainMod || {})) {
          const v = mainMod[k];
          if (typeof v === "function" && (v.name === "setupWSConnection" || k.toLowerCase().includes("setup"))) {
            _setupWSModule = mainMod;
            _setupWSConnection = v;
            return _setupWSConnection;
          }
        }
      } catch (e) {
        // require.resolve failed
      }
    } catch (e) {
      // require('y-websocket') failed
    }
    } catch (e) {
      // unexpected error while resolving y-websocket
  }

  throw new Error("Unable to resolve setupWSConnection from y-websocket. Ensure a compatible y-websocket version is installed.");
}

// Create a noServer WebSocketServer and provide an auth-aware upgrade handler
// that can be used by a centralized HTTP upgrade router (see back/src/index.js).
export function createYjsWebsocket(env) {
  const wss = new WebSocketServer({ noServer: true });

  async function handleUpgrade(req, socket, head) {
    try {
      const parsed = new URL(req.url, `http://${req.headers.host}`);
      const pathname = String(parsed.pathname || "");
      if (!pathname.startsWith("/yjs")) {
        return false;
      }

      // token may be provided as query param (token=...) OR via cookie (syncnote-token)
      let token = String(parsed.searchParams.get("token") || "").trim();
      const roomPath = pathname.replace(/^\/yjs\/?/, "");
      const parts = roomPath.split("/").filter(Boolean);
      const roomName = parts.join("/");
      const docId = roomName?.startsWith("doc-") ? roomName.slice(4) : roomName;

      // If no token in query, attempt to read cookie header (syncnote-token or syncnote_token)
      if (!token && req.headers && req.headers.cookie) {
        try {
          const cookies = String(req.headers.cookie || "").split(";").map((c) => c.trim());
          for (const c of cookies) {
            if (c.startsWith("syncnote-token=") || c.startsWith("syncnote_token=")) {
              token = decodeURIComponent(c.split("=")[1] || "");
              break;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const authHeader = token ? `Bearer ${token}` : (req.headers.authorization || "");

      if (!docId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return true;
      }

      const userId = getUserIdFromAuthHeader(authHeader);

      const allowed = await canAccessDocument(userId, docId);
      if (!allowed) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return true;
      }

      req.url = `/${roomName}${parsed.search || ""}`;
      wss.handleUpgrade(req, socket, head, async (ws) => {
        try {
          const setupWSConnection = await resolveSetupWSConnection();
          if (!setupWSConnection) {
            console.error("yjsWebsocket: setupWSConnection could not be resolved");
            try { ws.close(1011, "server error"); } catch {}
            return;
          }

          // Preload/apply history and attach persistence BEFORE calling setupWSConnection
          try {
            const candidates = [
              "y-websocket/bin/utils",
              "y-websocket/bin/utils.js",
              "y-websocket/dist/bin/utils.js",
              "y-websocket/dist/bin/utils.cjs",
              "y-websocket"
            ];

            let docsMap = null;
            let utilsModule = null;

            // Prefer the same module instance resolved when locating setupWSConnection
            if (_setupWSModule) {
              try {
                const candidateDocs = _setupWSModule.docs || (_setupWSModule.default && _setupWSModule.default.docs) || null;
                if (candidateDocs) {
                  docsMap = candidateDocs;
                  utilsModule = _setupWSModule.default || _setupWSModule;
                }
              } catch (e) {
                // ignore and fall back to probing candidates
              }
            }

            if (!docsMap) {
              for (const p of candidates) {
                try {
                  const mod = await import(p);
                  const candidateDocs = mod.docs || (mod.default && mod.default.docs);
                  if (candidateDocs) {
                    docsMap = candidateDocs;
                    utilsModule = mod.default || mod;
                    break;
                  }
                } catch (ie) {
                  try {
                    const { createRequire } = await import("module");
                    const require = createRequire(import.meta.url);
                    const modReq = require(p);
                    const candidateDocs = modReq.docs || (modReq.default && modReq.default.docs);
                    if (candidateDocs) {
                      docsMap = candidateDocs;
                      utilsModule = modReq.default || modReq;
                      break;
                    }
                  } catch (ee) {
                    // ignore
                  }
                }
              }
            }

            if (docsMap && typeof docsMap.get === "function") {
              const roomKeyFromReq = String(req.url || "").replace(/^\//, "").split("?")[0];
              const candidatesKeys = [roomKeyFromReq, `/${roomKeyFromReq}`, req.url, `doc-${docId}`];

              let docEntry = null;
              for (const k of candidatesKeys) {
                try {
                  const v = docsMap.get(k);
                  if (v) {
                    docEntry = v;
                    break;
                  }
                } catch (e) {
                  // ignore
                }
              }

              if (!docEntry) {
                // fallback: scan keys for a match containing the docId
                try {
                  for (const [k, v] of docsMap.entries()) {
                    if (String(k).includes(`doc-${docId}`) || String(k).includes(String(docId))) {
                      docEntry = v;
                      break;
                    }
                  }
                } catch (e) {
                  // ignore
                }
              }

              // If there's no existing entry, prefer creating one via the
              // y-websocket module's `getYDoc` so we get a proper WSSharedDoc
              // instance (it extends Y.Doc and wires awareness/conns/event handlers).
              if (!docEntry && utilsModule && typeof utilsModule.getYDoc === 'function') {
                try {
                  // `getYDoc` expects the doc name (no leading slash)
                  const cleanName = String(roomKeyFromReq || '').replace(/^\//, '');
                  docEntry = utilsModule.getYDoc(cleanName);
                } catch (e) {
                  // getYDoc failed
                }
              }

              // docEntry may be a Y.Doc or an object containing { doc: Y.Doc }
              const ydoc = docEntry && (docEntry.doc || docEntry);

              try {
                const debugKeys = [];
                try {
                  for (const k of docsMap.keys()) debugKeys.push(String(k));
                } catch (e) {}
                // sample docsMap keys and docEntry presence checked
                if (ydoc) {
                  try {
                    const types = [];
                    if (typeof ydoc.getText === 'function') {
                      const t = ydoc.getText('content');
                      types.push({ name: 'content', len: t ? t.toString().length : 0 });
                    }
                    if (typeof ydoc.getXmlFragment === 'function') {
                      const xf = ydoc.getXmlFragment('prosemirror');
                      types.push({ name: 'prosemirror', len: xf ? xf.length || null : 0 });
                    }
                  } catch (e) {
                    // could not inspect preloaded ydoc
                  }
                }
              } catch (e) {}

                if (ydoc && !ydoc.__persistenceAttached) {
                ydoc.__persistenceAttached = true;

                // Helper to normalize several DB snapshot representations to Uint8Array
                const toUint8 = (buf) => {
                  if (!buf) return null;
                  if (buf instanceof Uint8Array) return buf;
                  if (Buffer.isBuffer(buf)) return new Uint8Array(buf);
                  if (typeof buf === 'string') {
                    // try base64 first
                    try {
                      const b = Buffer.from(buf, 'base64');
                      if (b && b.length) return new Uint8Array(b);
                    } catch (e) {}
                    try {
                      const b2 = Buffer.from(buf, 'binary');
                      if (b2 && b2.length) return new Uint8Array(b2);
                    } catch (e) {}
                    // fallback to raw char codes
                    const arr = new Uint8Array(buf.length);
                    for (let i = 0; i < buf.length; i++) arr[i] = buf.charCodeAt(i);
                    return arr;
                  }
                  if (buf && typeof buf === 'object' && Array.isArray(buf.data)) return new Uint8Array(buf.data);
                  return null;
                };

                // Apply latest full snapshot first (if present), then replay incremental history.
                try {
                  try {
                    const snap = await dbQuery(`SELECT snapshot FROM document_snapshots WHERE document_id = $1`, [docId]);
                    if (snap && snap.rows && snap.rows[0] && snap.rows[0].snapshot) {
                      const buf = snap.rows[0].snapshot;
                      const update = toUint8(buf);
                      if (update && update.length) {
                        try { Y.applyUpdate(ydoc, update); } catch (e) { console.error('yjsWebsocket: failed to apply full snapshot', { docId, err: e && (e.stack || e) }); }
                      } else {
                        console.warn('yjsWebsocket: full snapshot had no usable bytes', { docId, rawType: typeof buf });
                      }
                    }
                  } catch (e) {
                    console.error('yjsWebsocket: error loading full snapshot', e && (e.stack || e));
                  }

                  // Now replay incremental history (if any). These are applied on top
                  // of the full snapshot so they represent more recent changes.
                  const hist = await dbQuery(
                    `SELECT id, snapshot FROM document_snapshots_history WHERE document_id = $1 ORDER BY id ASC`,
                    [docId]
                  );
                  if (hist && hist.rows && hist.rows.length) {
                    for (const r of hist.rows) {
                      try {
                        const update = toUint8(r.snapshot);
                        if (update && update.length) {
                          try { Y.applyUpdate(ydoc, update); } catch (e) {
                            console.error('yjsWebsocket: failed to apply history row', { docId, id: r.id, len: update.length, err: e && (e.stack || e) });
                          }
                        } else {
                          console.warn('yjsWebsocket: history row had no usable snapshot bytes', { docId, id: r.id, rawType: typeof r.snapshot });
                        }
                      } catch (e) {
                        console.error('yjsWebsocket: error while processing history row', { docId, err: e && (e.stack || e) });
                      }
                    }
                    // applied history updates
                  }
                } catch (e) {
                  console.error("yjsWebsocket: failed to load/apply persistence", e && (e.stack || e));
                }

                const persistenceTimers = new Map();

                // Persist a full snapshot immediately (with basic debounce/in-flight guard)
                const persistNow = async (docRef) => {
                  if (!docRef) return;
                  if (docRef.__persistenceInFlight) return;
                  docRef.__persistenceInFlight = true;
                  try {
                    const snapshot = Y.encodeStateAsUpdate(docRef);
                    const snapshotBuffer = Buffer.from(snapshot);
                    // Upsert latest full snapshot for fast restores
                    await dbQuery(
                      `INSERT INTO document_snapshots (document_id, snapshot, updated_at) VALUES ($1, $2, now()) ON CONFLICT (document_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`,
                      [docId, snapshotBuffer]
                    );
                    try {
                      await Document.touchUpdatedAt(docId);
                    } catch (e) {
                      // ignore
                    }

                    // Cleanup history rows according to config
                    try {
                      const keepRows = Number(env.yjsHistoryKeepRows || 0);
                      if (keepRows > 0) {
                        await dbQuery(
                          `DELETE FROM document_snapshots_history WHERE document_id = $1 AND id NOT IN (SELECT id FROM document_snapshots_history WHERE document_id = $1 ORDER BY id DESC LIMIT $2)`,
                          [docId, keepRows]
                        );
                      }
                    } catch (e) {
                      console.error('yjsWebsocket: history cleanup (keepRows) failed', e && (e.stack || e));
                    }

                    try {
                      const maxAge = Number(env.yjsHistoryMaxAgeDays || 0);
                      if (maxAge > 0) {
                        await dbQuery(
                          `DELETE FROM document_snapshots_history WHERE document_id = $1 AND created_at < now() - ($2 * INTERVAL '1 day')`,
                          [docId, maxAge]
                        );
                      }
                    } catch (e) {
                      console.error('yjsWebsocket: history cleanup (age) failed', e && (e.stack || e));
                    }
                  } catch (err) {
                    console.error("yjsWebsocket: failed to persist full snapshot", err && (err.stack || err));
                  } finally {
                    try { delete docRef.__persistenceInFlight; } catch (e) {}
                  }
                };

                const schedulePersist = (docRef) => {
                  if (persistenceTimers.has(roomKeyFromReq)) {
                    clearTimeout(persistenceTimers.get(roomKeyFromReq));
                  }
                  const debounceMs = Number(env.yjsSnapshotDebounceMs || 2000) || 2000;
                  const t = setTimeout(async () => {
                    persistenceTimers.delete(roomKeyFromReq);
                    try {
                      await persistNow(docRef);
                    } catch (err) {
                      console.error('yjsWebsocket: scheduled persist failed', err && (err.stack || err));
                    }
                  }, debounceMs);
                  persistenceTimers.set(roomKeyFromReq, t);
                };

                // helper to compute rough editor content length for logging
                const getContentLen = (docRef) => {
                  try {
                    if (!docRef) return 0;
                    if (typeof docRef.getText === 'function') {
                      const t = docRef.getText('content');
                      if (t && typeof t.toString === 'function') return t.toString().length;
                    }
                    if (typeof docRef.getXmlFragment === 'function') {
                      const xf = docRef.getXmlFragment('prosemirror');
                      if (xf && typeof xf.length === 'number') return xf.length;
                      try { return String(xf || '').length; } catch (e) {}
                    }
                  } catch (e) {}
                  return 0;
                };

                // Attach persistence/update handler to a runtime Y.Doc (or WSSharedDoc wrapper)
                const attachPersistenceToDoc = (docRef, shared) => {
                  try {
                    const docObj = docRef && (docRef.doc || docRef);
                    if (!docObj) return;
                    if (docObj.__persistenceAttached) return;
                    docObj.__persistenceAttached = true;

                    // initialize last-content length tracker for this doc
                    try {
                      docObj.__lastContentLen = getContentLen(docObj) || 0;
                    } catch (e) { docObj.__lastContentLen = 0; }

                    const handler = async (update, origin) => {
                      try {
                        const updateLen = update && (update.byteLength || update.length) ? (update.byteLength || update.length) : null;
                        // compute connected clients count for this shared doc (best-effort)
                        let connCount = null;
                        try {
                          const sharedLocal = shared || docEntry || null;
                          if (sharedLocal) {
                            if (sharedLocal.conns && typeof sharedLocal.conns.size === 'number') {
                              connCount = sharedLocal.conns.size;
                            } else if (sharedLocal.conns && typeof sharedLocal.conns === 'object') {
                              connCount = Object.keys(sharedLocal.conns).length;
                            } else if (sharedLocal._conns && typeof sharedLocal._conns.size === 'number') {
                              connCount = sharedLocal._conns.size;
                            } else if (docsMap && typeof docsMap.get === 'function') {
                              try {
                                for (const [k, v] of docsMap.entries()) {
                                  if (v === sharedLocal || (v && v.doc === docObj)) {
                                    const candidate = v;
                                    if (candidate.conns && typeof candidate.conns.size === 'number') connCount = candidate.conns.size;
                                    else if (candidate._conns && typeof candidate._conns.size === 'number') connCount = candidate._conns.size;
                                    else if (candidate.conns && typeof candidate.conns === 'object') connCount = Object.keys(candidate.conns).length;
                                    break;
                                  }
                                }
                              } catch (e) {}
                            }
                          }
                        } catch (e) {}

                        // received update
                        const prevLen = Number(docObj.__lastContentLen || 0);

                        const buf = Buffer.from(update);
                        await dbQuery(`INSERT INTO document_snapshots_history (document_id, snapshot, saved_by) VALUES ($1, $2, $3)`, [docId, buf, null]);

                        // Increment update counter and optionally persist a full snapshot
                        try {
                          docObj.__updateCount = Number(docObj.__updateCount || 0) + 1;
                          const threshold = Number(env.yjsSnapshotEveryUpdates || 0);
                          if (threshold > 0 && docObj.__updateCount >= threshold) {
                            docObj.__updateCount = 0;
                            if (persistenceTimers.has(roomKeyFromReq)) {
                              clearTimeout(persistenceTimers.get(roomKeyFromReq));
                              persistenceTimers.delete(roomKeyFromReq);
                            }
                            try { await persistNow(docObj); } catch (e) { /* best-effort */ }
                          } else {
                            try { schedulePersist(docObj); } catch (e) { /* ignore */ }
                          }
                        } catch (e) {
                          try { schedulePersist(docObj); } catch (ee) { /* ignore */ }
                        }

                        // compute new content length after applying update
                        try {
                          const newLen = getContentLen(docObj) || 0;
                          if (newLen === 0 && prevLen > 0) {
                            console.warn('yjsWebsocket: ydoc update cleared content', { docId, prevLen, updateLen });
                          }
                          docObj.__lastContentLen = newLen;
                        } catch (e) {
                          // ignore content-length calc failures
                        }
                      } catch (err) {
                        console.error("yjsWebsocket: failed to append update to history", err && (err.stack || err));
                      }
                      // scheduling moved into update-count logic above
                    };

                    try {
                      docObj.on("update", handler);
                      docObj.__persistenceHandler = handler;
                    } catch (e) {
                      console.error("yjsWebsocket: could not attach update listener", e && (e.stack || e));
                    }
                  } catch (e) {
                    console.error('yjsWebsocket: attachPersistenceToDoc failed', e && (e.stack || e));
                  }
                };

                // Ensure we have at least one persisted full snapshot after applying history
                try { attachPersistenceToDoc(ydoc, docEntry); } catch (e) { /* ignore */ }
              }
            }
            } catch (err) {
            // persistence attach skipped
          }

          // Now invoke the y-websocket setup (after history applied)
          try {
            setupWSConnection(ws, req, { gc: true });

            // Post-setup check: verify that the docs map inside the y-websocket
            // module now references the same doc we applied persistence to.
            try {
              const mod = utilsModule || _setupWSModule;
              const candidateDocs = mod && (mod.docs || (mod.default && mod.default.docs));
              if (candidateDocs && typeof candidateDocs.get === 'function') {
                const lookupKeys = [roomKeyFromReq, `/${roomKeyFromReq}`, req.url, `doc-${docId}`];
                let mapped = null;
                for (const k of lookupKeys) {
                  try { mapped = candidateDocs.get(k); } catch (e) { mapped = mapped || null; }
                  if (mapped) break;
                }
                  try {
                    // post-setup doc mapping checked (debug removed)
                  } catch (e) {}

                  // If the runtime created a different doc instance, merge our
                  // preloaded state into the runtime doc and attach persistence
                  if (mapped && mapped !== docEntry) {
                    try {
                      const runtimeDoc = (mapped && (mapped.doc || mapped));
                      const sourceDoc = (docEntry && (docEntry.doc || docEntry));
                      if (runtimeDoc && sourceDoc && runtimeDoc !== sourceDoc) {
                        try {
                          const mergeUpdate = Y.encodeStateAsUpdate(sourceDoc);
                            if (mergeUpdate && mergeUpdate.length) {
                            Y.applyUpdate(runtimeDoc, mergeUpdate);
                          }
                        } catch (e) {
                          console.error('yjsWebsocket: failed to merge preloaded state into runtime doc', e && (e.stack || e));
                        }

                        // detach persistence from the preloaded source doc (if attached)
                        try {
                          if (sourceDoc.__persistenceHandler && typeof sourceDoc.off === 'function') {
                            try { sourceDoc.off('update', sourceDoc.__persistenceHandler); } catch (e) {}
                            delete sourceDoc.__persistenceHandler;
                            sourceDoc.__persistenceAttached = false;
                          }
                        } catch (e) {}

                        // clear any pending persist timers for this room and reattach to runtimeDoc
                        try {
                          if (persistenceTimers.has(roomKeyFromReq)) {
                            clearTimeout(persistenceTimers.get(roomKeyFromReq));
                            persistenceTimers.delete(roomKeyFromReq);
                          }
                        } catch (e) {}

                        try { attachPersistenceToDoc(runtimeDoc, mapped); } catch (e) {}
                      }
                    } catch (e) {
                      console.error('yjsWebsocket: error while reconciling mapped doc', e && (e.stack || e));
                    }
                  }
              }
            } catch (e) {
              // ignore post-check failures
            }
          } catch (e) {
            console.error("yjsWebsocket: setupWSConnection threw:", e && (e.stack || e));
            try { ws.close(1011, "server error"); } catch {}
          }
        } catch (e) {
          console.error("yjsWebsocket: resolveSetupWSConnection failed", e && (e.stack || e));
          try { ws.close(1011, "server error"); } catch {}
        }
      });

      return true;
    } catch (err) {
      console.error("yjsWebsocket: upgrade handler error", err);
      try { socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n"); } catch {}
      try { socket.destroy(); } catch {}
      return true;
    }
  }

  return { wss, handleUpgrade };
}
