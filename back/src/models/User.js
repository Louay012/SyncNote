import { query } from "../db/postgres.js";
import { mapUser } from "./_shared.js";

const User = {
  async findById(id) {
    const { rows } = await query(
      "SELECT id, name, email, password, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
    return mapUser(rows[0]);
  },

  async findOne(filter = {}) {
    if (filter.email) {
      const { rows } = await query(
        "SELECT id, name, email, password, created_at, updated_at FROM users WHERE email = $1",
        [filter.email]
      );
      return mapUser(rows[0]);
    }

    return null;
  },

  async findByIds(ids = []) {
    if (!ids.length) {
      return [];
    }

    const { rows } = await query(
      "SELECT id, name, email, password, created_at, updated_at FROM users WHERE id = ANY($1::bigint[])",
      [ids]
    );

    return rows.map(mapUser);
  },

  async create({ name, email, password }) {
    const { rows } = await query(
      `
        INSERT INTO users(name, email, password)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, password, created_at, updated_at
      `,
      [name, email, password]
    );

    return mapUser(rows[0]);
  },

  async findByIdAndUpdate(id, updates, options = {}) {
    const values = [];
    const sets = [];

    if (Object.hasOwn(updates, "name")) {
      values.push(updates.name);
      sets.push(`name = $${values.length}`);
    }

    if (!sets.length) {
      return options.new ? this.findById(id) : null;
    }

    values.push(id);

    const { rows } = await query(
      `
        UPDATE users
        SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, name, email, password, created_at, updated_at
      `,
      values
    );

    return mapUser(rows[0]);
  }
};

export default User;
