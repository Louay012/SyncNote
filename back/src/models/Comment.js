import { query } from "../db/postgres.js";
import { mapComment } from "./_shared.js";

const baseSelect =
  "SELECT id, text, author_id, section_id, created_at, updated_at FROM comments";

const Comment = {
  async create({ text, author, section }) {
    const { rows } = await query(
      `
        INSERT INTO comments(text, author_id, section_id)
        VALUES ($1, $2, $3)
        RETURNING id, text, author_id, section_id, created_at, updated_at
      `,
      [text, author, section]
    );

    return mapComment(rows[0]);
  },

  async deleteMany(filter = {}) {
    if (filter.section) {
      await query("DELETE FROM comments WHERE section_id = $1", [filter.section]);
      return;
    }

    if (filter.document) {
      await query(
        `
          DELETE FROM comments c
          USING sections s
          WHERE c.section_id = s.id
            AND s.document_id = $1
        `,
        [filter.document]
      );
    }
  },

  async find(filter = {}) {
    if (filter.section) {
      const { rows } = await query(
        `${baseSelect} WHERE section_id = $1 ORDER BY created_at DESC`,
        [filter.section]
      );
      return rows.map(mapComment);
    }

    if (filter.document) {
      const { rows } = await query(
        `
          SELECT c.id, c.text, c.author_id, c.section_id, s.document_id, c.created_at, c.updated_at
          FROM comments c
          INNER JOIN sections s ON s.id = c.section_id
          WHERE s.document_id = $1
          ORDER BY c.created_at DESC
        `,
        [filter.document]
      );
      return rows.map(mapComment);
    }

    return [];
  },

  async findByDocumentIds(documentIds = []) {
    if (!documentIds.length) {
      return [];
    }

    const { rows } = await query(
      `
        SELECT c.id, c.text, c.author_id, c.section_id, s.document_id, c.created_at, c.updated_at
        FROM comments c
        INNER JOIN sections s ON s.id = c.section_id
        WHERE s.document_id = ANY($1::bigint[])
        ORDER BY s.document_id, c.created_at DESC
      `,
      [documentIds]
    );

    return rows.map(mapComment);
  }
};

export default Comment;
