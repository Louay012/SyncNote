import { query } from "../db/postgres.js";

const Like = {
  async findOne({ documentId, userId } = {}) {
    if (!documentId || !userId) {
      return null;
    }

    const { rows } = await query(
      `
        SELECT document_id, user_id, created_at
        FROM document_likes
        WHERE document_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [documentId, userId]
    );

    return rows[0]
      ? {
          documentId: String(rows[0].document_id),
          userId: String(rows[0].user_id),
          createdAt: rows[0].created_at
        }
      : null;
  },

  async like(documentId, userId) {
    const { rows } = await query(
      `
        INSERT INTO document_likes(document_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (document_id, user_id)
        DO UPDATE SET created_at = document_likes.created_at
        RETURNING document_id, user_id, created_at
      `,
      [documentId, userId]
    );

    return {
      documentId: String(rows[0].document_id),
      userId: String(rows[0].user_id),
      createdAt: rows[0].created_at
    };
  },

  async unlike(documentId, userId) {
    const result = await query(
      "DELETE FROM document_likes WHERE document_id = $1 AND user_id = $2",
      [documentId, userId]
    );

    return result.rowCount > 0;
  },

  async countByDocumentId(documentId) {
    const { rows } = await query(
      "SELECT COUNT(*)::int AS total FROM document_likes WHERE document_id = $1",
      [documentId]
    );

    return Number(rows[0]?.total || 0);
  },

  async countByDocumentIds(documentIds = []) {
    if (!documentIds.length) {
      return [];
    }

    const { rows } = await query(
      `
        SELECT document_id, COUNT(*)::int AS total
        FROM document_likes
        WHERE document_id = ANY($1::bigint[])
        GROUP BY document_id
      `,
      [documentIds]
    );

    return rows.map((row) => ({
      documentId: String(row.document_id),
      total: Number(row.total)
    }));
  },

  async findByUserAndDocumentIds(userId, documentIds = []) {
    if (!userId || !documentIds.length) {
      return [];
    }

    const { rows } = await query(
      `
        SELECT document_id
        FROM document_likes
        WHERE user_id = $1
          AND document_id = ANY($2::bigint[])
      `,
      [userId, documentIds]
    );

    return rows.map((row) => String(row.document_id));
  },

  async findExistingPairs(pairs = []) {
    if (!pairs.length) {
      return [];
    }

    const values = [];
    const placeholders = pairs
      .map(({ documentId, userId }, index) => {
        const base = index * 2;
        values.push(documentId, userId);
        return `($${base + 1}::bigint, $${base + 2}::bigint)`;
      })
      .join(", ");

    const { rows } = await query(
      `
        SELECT dl.document_id, dl.user_id
        FROM document_likes dl
        JOIN (VALUES ${placeholders}) AS incoming(document_id, user_id)
          ON dl.document_id = incoming.document_id
         AND dl.user_id = incoming.user_id
      `,
      values
    );

    return rows.map((row) => ({
      documentId: String(row.document_id),
      userId: String(row.user_id)
    }));
  }
};

export default Like;
