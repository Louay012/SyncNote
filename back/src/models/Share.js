import { query } from "../db/postgres.js";
import { mapShare } from "./_shared.js";

const baseSelect =
  "SELECT id, document_id, user_id, permission, created_at, updated_at FROM shares";

const Share = {
  async find(filter = {}) {
    if (filter.user) {
      const { rows } = await query(
        `${baseSelect} WHERE user_id = $1 ORDER BY updated_at DESC`,
        [filter.user]
      );
      return rows.map(mapShare);
    }

    if (filter.document) {
      const { rows } = await query(
        `${baseSelect} WHERE document_id = $1 ORDER BY updated_at DESC`,
        [filter.document]
      );
      return rows.map(mapShare);
    }

    return [];
  },

  async findOne(filter = {}) {
    const conditions = [];
    const values = [];

    if (filter.document) {
      values.push(filter.document);
      conditions.push(`document_id = $${values.length}`);
    }

    if (filter.user) {
      values.push(filter.user);
      conditions.push(`user_id = $${values.length}`);
    }

    if (filter.permission) {
      values.push(filter.permission);
      conditions.push(`permission = $${values.length}`);
    }

    if (!conditions.length) {
      return null;
    }

    const { rows } = await query(
      `${baseSelect} WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values
    );

    return mapShare(rows[0]);
  },

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    if (!filter.document || !filter.user) {
      return null;
    }

    const permission = update.permission ?? "EDIT";

    const { rows } = await query(
      `
        INSERT INTO shares(document_id, user_id, permission)
        VALUES ($1, $2, $3)
        ON CONFLICT (document_id, user_id)
        DO UPDATE SET permission = EXCLUDED.permission, updated_at = NOW()
        RETURNING id, document_id, user_id, permission, created_at, updated_at
      `,
      [filter.document, filter.user, permission]
    );

    if (!options.new && !options.upsert) {
      return null;
    }

    return mapShare(rows[0]);
  },

  async deleteMany(filter = {}) {
    if (!filter.document) {
      return;
    }

    await query("DELETE FROM shares WHERE document_id = $1", [filter.document]);
  },

  async deleteOne(filter = {}) {
    if (!filter.document || !filter.user) {
      return false;
    }

    const result = await query(
      "DELETE FROM shares WHERE document_id = $1 AND user_id = $2",
      [filter.document, filter.user]
    );

    return result.rowCount > 0;
  }
};

export default Share;
