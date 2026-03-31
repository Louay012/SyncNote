import { query } from "../db/postgres.js";
import { mapVersion } from "./_shared.js";

function normalizeSnapshot(snapshot) {
  if (typeof snapshot === "string") {
    try {
      return JSON.parse(snapshot);
    } catch {
      throw new Error("Snapshot must be valid JSON");
    }
  }

  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Snapshot must be an object");
  }

  return snapshot;
}

const Version = {
  async create({ documentId, snapshot, createdBy }) {
    const normalizedSnapshot = normalizeSnapshot(snapshot);

    const { rows } = await query(
      `
        INSERT INTO versions(document_id, snapshot, created_by)
        VALUES ($1, $2::jsonb, $3)
        RETURNING id, document_id, snapshot, created_by, created_at
      `,
      [documentId, JSON.stringify(normalizedSnapshot), createdBy]
    );

    return mapVersion(rows[0]);
  },

  async findById(id) {
    const { rows } = await query(
      `
        SELECT id, document_id, snapshot, created_by, created_at
        FROM versions
        WHERE id = $1
      `,
      [id]
    );

    return mapVersion(rows[0]);
  },

  async findByDocument(documentId, limit = 30) {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

    const { rows } = await query(
      `
        SELECT id, document_id, snapshot, created_by, created_at
        FROM versions
        WHERE document_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [documentId, safeLimit]
    );

    return rows.map(mapVersion);
  },

  async deleteMany(filter = {}) {
    if (!filter.document) {
      return;
    }

    await query("DELETE FROM versions WHERE document_id = $1", [filter.document]);
  }
};

export default Version;
