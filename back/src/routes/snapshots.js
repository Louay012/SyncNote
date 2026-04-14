import express from "express";
import { query as dbQuery } from "../db/postgres.js";
import { getUserIdFromAuthHeader } from "../utils/auth.js";
import { canEditDocument } from "../utils/permissions.js";
import Document from "../models/Document.js";

const router = express.Router();

// Accept raw binary snapshot data (Yjs encoded update)
router.post(
  "/beacon",
  express.raw({ type: "*/*", limit: "8mb" }),
  async (req, res) => {
    try {
      const docId = String(req.query.docId || req.headers["x-doc-id"] || "").trim();
      const token = String(req.query.token || (req.headers.authorization || "")).trim();

      if (!docId) {
        return res.status(400).json({ error: "docId is required" });
      }

      const authHeader = token && !token.startsWith("Bearer") ? `Bearer ${token}` : token || req.headers.authorization;
      const userId = getUserIdFromAuthHeader(authHeader);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!(await canEditDocument(userId, docId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const body = req.body || Buffer.alloc(0);
      const snapshotBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""));

      await dbQuery(
        `INSERT INTO document_snapshots (document_id, snapshot, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (document_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`,
        [docId, snapshotBuffer]
      );

      await dbQuery(
        `INSERT INTO document_snapshots_history (document_id, snapshot, saved_by) VALUES ($1, $2, $3)`,
        [docId, snapshotBuffer, userId]
      );

      try { await Document.touchUpdatedAt(docId); } catch (e) {}

      return res.status(200).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("/snapshots/beacon error", err);
      return res.status(500).json({ error: "server_error" });
    }
  }
);

export function attachSnapshotRoutes(app) {
  app.use("/snapshots", router);
}
