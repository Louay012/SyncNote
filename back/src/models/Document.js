import { query } from "../db/postgres.js";
import { mapDocument } from "./_shared.js";

const baseSelect =
  "SELECT id, title, content, owner_id, created_at, updated_at FROM documents";

const Document = {
  async findById(id) {
    const { rows } = await query(`${baseSelect} WHERE id = $1`, [id]);
    return mapDocument(rows[0]);
  },

  async findByOwner(ownerId) {
    const { rows } = await query(
      `${baseSelect} WHERE owner_id = $1 ORDER BY updated_at DESC`,
      [ownerId]
    );
    return rows.map(mapDocument);
  },

  async findByIds(ids = []) {
    if (!ids.length) {
      return [];
    }

    const { rows } = await query(
      `${baseSelect} WHERE id = ANY($1::bigint[]) ORDER BY updated_at DESC`,
      [ids]
    );

    return rows.map(mapDocument);
  },

  async searchAccessible(userId, keyword) {
    const { rows } = await query(
      `
        SELECT DISTINCT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at
        FROM documents d
        LEFT JOIN shares s ON s.document_id = d.id
        WHERE (d.owner_id = $1 OR s.user_id = $1)
          AND (d.title ILIKE $2 OR d.content ILIKE $2)
        ORDER BY d.updated_at DESC
      `,
      [userId, `%${keyword}%`]
    );

    return rows.map(mapDocument);
  },

  async create({ title, content = "", owner }) {
    const { rows } = await query(
      `
        INSERT INTO documents(title, content, owner_id)
        VALUES ($1, $2, $3)
        RETURNING id, title, content, owner_id, created_at, updated_at
      `,
      [title, content, owner]
    );

    return mapDocument(rows[0]);
  },

  async findByIdAndUpdate(id, updates, options = {}) {
    const values = [];
    const sets = [];

    if (Object.hasOwn(updates, "title")) {
      values.push(updates.title);
      sets.push(`title = $${values.length}`);
    }

    if (Object.hasOwn(updates, "content")) {
      values.push(updates.content);
      sets.push(`content = $${values.length}`);
    }

    if (!sets.length) {
      return options.new ? this.findById(id) : null;
    }

    values.push(id);

    const { rows } = await query(
      `
        UPDATE documents
        SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, title, content, owner_id, created_at, updated_at
      `,
      values
    );

    return mapDocument(rows[0]);
  },

  async findByIdAndDelete(id) {
    const { rows } = await query(
      `
        DELETE FROM documents
        WHERE id = $1
        RETURNING id, title, content, owner_id, created_at, updated_at
      `,
      [id]
    );

    return mapDocument(rows[0]);
  }
};

export default Document;
