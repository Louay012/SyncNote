import { query } from "../db/postgres.js";
import { mapComment } from "./_shared.js";

const baseSelect =
  "SELECT id, text, author_id, document_id, created_at, updated_at FROM comments";

const Comment = {
  async create({ text, author, document }) {
    const { rows } = await query(
      `
        INSERT INTO comments(text, author_id, document_id)
        VALUES ($1, $2, $3)
        RETURNING id, text, author_id, document_id, created_at, updated_at
      `,
      [text, author, document]
    );

    return mapComment(rows[0]);
  },

  async deleteMany(filter = {}) {
    if (!filter.document) {
      return;
    }

    await query("DELETE FROM comments WHERE document_id = $1", [filter.document]);
  },

  async find(filter = {}) {
    if (filter.document) {
      const { rows } = await query(
        `${baseSelect} WHERE document_id = $1 ORDER BY created_at DESC`,
        [filter.document]
      );
      return rows.map(mapComment);
    }

    return [];
  }
};

export default Comment;
