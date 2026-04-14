import express from "express";
import { query as dbQuery } from "../db/postgres.js";

const router = express.Router();

// Development-only: return snapshot info for a document id
router.get("/snapshot/:docId", async (req, res) => {
  try {
    const docId = String(req.params.docId || "").trim();
    if (!docId) return res.status(400).json({ error: "docId required" });
    const { rows } = await dbQuery(
      `SELECT octet_length(snapshot) as len FROM document_snapshots WHERE document_id = $1`,
      [docId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ found: false });
    }
    const len = rows[0].len || 0;
    return res.status(200).json({ found: true, len });
  } catch (e) {
    console.error("/internal/debug/snapshot error", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// Development-only: inspect decoded Yjs snapshot types
router.get("/snapshot-types/:docId", async (req, res) => {
  try {
    const docId = String(req.params.docId || "").trim();
    if (!docId) return res.status(400).json({ error: "docId required" });
    const { rows } = await dbQuery(
      `SELECT snapshot FROM document_snapshots WHERE document_id = $1`,
      [docId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ found: false });
    }

    const snapshot = rows[0].snapshot;
    if (!snapshot) return res.status(200).json({ found: true, types: [] });

    // Decode update into a fresh Y.Doc to inspect top-level keys
    try {
      const Y = await import("yjs");
      const doc = new Y.Doc();
      const update = Buffer.isBuffer(snapshot) ? new Uint8Array(snapshot) : new Uint8Array(Buffer.from(String(snapshot || "")));
      try { Y.applyUpdate(doc, update); } catch (e) { /* apply best-effort */ }

      const types = [];
      try {
        // check for common names used by the editor
        if (typeof doc.getXmlFragment === 'function') {
          const xf = doc.getXmlFragment('prosemirror');
          if (xf) types.push('prosemirror');
        }
        if (typeof doc.getText === 'function') {
          const t = doc.getText('content');
          if (t) types.push('content');
        }
        // list all keys present on the doc (Y.Doc stores types in doc._map)
        try {
          const all = [];
          // doc._map is internal — try to inspect available keys gracefully
          if (doc && doc.constructor && doc instanceof Y.Doc) {
            // iterate doc.share.types if available
            const share = doc.share || doc._map || {};
            const keys = Object.keys(share || {});
            for (const k of keys) {
              if (!all.includes(k)) all.push(k);
            }
            // also include keys from doc.get* checks
            for (const k of all) if (!types.includes(k)) types.push(k);
          }
        } catch (e) {}
      } catch (e) {}

      return res.status(200).json({ found: true, types });
    } catch (e) {
      console.error('snapshot-types decode failed', e);
      return res.status(500).json({ error: 'decode_failed' });
    }
  } catch (e) {
    console.error("/internal/debug/snapshot-types error", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// Development-only: return history count and recent entries for a document
router.get("/snapshot-history/:docId", async (req, res) => {
  try {
    const docId = String(req.params.docId || "").trim();
    if (!docId) return res.status(400).json({ error: "docId required" });

    const { rows: countRows } = await dbQuery(
      `SELECT COUNT(*)::int AS count FROM document_snapshots_history WHERE document_id = $1`,
      [docId]
    );
    const count = (countRows && countRows[0] && Number(countRows[0].count)) || 0;

    const { rows: recentRows } = await dbQuery(
      `SELECT id, octet_length(snapshot) as len, saved_by, created_at FROM document_snapshots_history WHERE document_id = $1 ORDER BY id DESC LIMIT 20`,
      [docId]
    );

    return res.status(200).json({ found: true, count, recent: recentRows });
  } catch (e) {
    console.error("/internal/debug/snapshot-history error", e);
    return res.status(500).json({ error: "server_error" });
  }
});

export function attachDebugRoutes(app) {
  app.use("/internal/debug", router);
}
