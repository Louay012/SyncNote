import { query } from "../db/postgres.js";
import { mapDocument } from "./_shared.js";

const baseSelect =
  "SELECT id, title, content, is_public, owner_id, created_at, updated_at FROM documents";

function mapSortField(sortBy = "UPDATED_AT") {
  const sortMap = {
    UPDATED_AT: "d.updated_at",
    CREATED_AT: "d.created_at",
    TITLE: "d.title"
  };

  return sortMap[sortBy] || sortMap.UPDATED_AT;
}

function mapSortDirection(direction = "DESC") {
  return direction === "ASC" ? "ASC" : "DESC";
}

function mapPagination(limit = 20, offset = 0) {
  return {
    limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
    offset: Math.max(Number(offset) || 0, 0)
  };
}

async function runPagedDocumentQuery({
  whereSql,
  params,
  limit,
  offset,
  sortBy,
  sortDirection
}) {
  const orderBy = mapSortField(sortBy);
  const orderDirection = mapSortDirection(sortDirection);
  const page = mapPagination(limit, offset);

  const countResult = await query(
    `
      SELECT COUNT(DISTINCT d.id) AS total
      FROM documents d
      LEFT JOIN shares s ON s.document_id = d.id
      WHERE ${whereSql}
    `,
    params
  );

  const listResult = await query(
    `
      SELECT DISTINCT d.id, d.title, d.content, d.is_public, d.owner_id, d.created_at, d.updated_at
      FROM documents d
      LEFT JOIN shares s ON s.document_id = d.id
      WHERE ${whereSql}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, page.limit, page.offset]
  );

  return {
    items: listResult.rows.map(mapDocument),
    total: Number(countResult.rows[0]?.total || 0),
    limit: page.limit,
    offset: page.offset
  };
}

const Document = {
  async findById(id) {
    const { rows } = await query(`${baseSelect} WHERE id = $1`, [id]);
    return mapDocument(rows[0]);
  },

  async findByOwner(ownerId, options = {}) {
    return runPagedDocumentQuery({
      whereSql: "d.owner_id = $1",
      params: [ownerId],
      ...options
    });
  },

  async findSharedWithUser(userId, options = {}) {
    return runPagedDocumentQuery({
      whereSql: "s.user_id = $1 AND d.owner_id <> $1",
      params: [userId],
      ...options
    });
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

  async searchAccessible(userId, keyword, options = {}) {
    return runPagedDocumentQuery({
      whereSql:
        "(d.owner_id = $1 OR s.user_id = $1) AND (d.title ILIKE $2 OR EXISTS (SELECT 1 FROM sections sec WHERE sec.document_id = d.id AND sec.content ILIKE $2))",
      params: [userId, `%${keyword}%`],
      ...options
    });
  },

  async searchOtherUsersByTitle(userId, keyword, options = {}) {
    const mode = String(options.mode || "TITLE");
    const modeWhereSql =
      mode === "CONTENT"
        ? "EXISTS (SELECT 1 FROM sections sec WHERE sec.document_id = d.id AND sec.content ILIKE $2)"
        : "d.title ILIKE $2";

    return runPagedDocumentQuery({
      whereSql: `d.owner_id <> $1 AND d.is_public = true AND (${modeWhereSql})`,
      params: [userId, `%${keyword}%`],
      ...options
    });
  },

  async create({ title, content = "", owner, isPublic = false }) {
    const { rows } = await query(
      `
        INSERT INTO documents(title, content, is_public, owner_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, content, is_public, owner_id, created_at, updated_at
      `,
      [title, content, Boolean(isPublic), owner]
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

    if (Object.hasOwn(updates, "isPublic")) {
      values.push(Boolean(updates.isPublic));
      sets.push(`is_public = $${values.length}`);
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
        RETURNING id, title, content, is_public, owner_id, created_at, updated_at
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
        RETURNING id, title, content, is_public, owner_id, created_at, updated_at
      `,
      [id]
    );

    return mapDocument(rows[0]);
  },

  async touchUpdatedAt(id) {
    const { rows } = await query(
      `
        UPDATE documents
        SET updated_at = NOW()
        WHERE id = $1
        RETURNING id, title, content, is_public, owner_id, created_at, updated_at
      `,
      [id]
    );

    return mapDocument(rows[0]);
  }
};

export default Document;
