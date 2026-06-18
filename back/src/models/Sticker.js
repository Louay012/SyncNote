import { query as dbQuery } from "../db/postgres.js";

const Sticker = {
  /**
   * Get sticker catalog entries, optionally filtered by group or pack.
   */
  async catalog({ group, packId, search } = {}) {
    let sql = `SELECT * FROM sticker_catalog WHERE 1=1`;
    const params = [];
    let paramIdx = 1;

    if (group && group !== "all") {
      sql += ` AND group_name = $${paramIdx++}`;
      params.push(group);
    }

    if (packId) {
      sql += ` AND pack_id = $${paramIdx++}`;
      params.push(packId);
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      sql += ` AND (label ILIKE $${paramIdx} OR tags::text ILIKE $${paramIdx})`;
      paramIdx++;
      params.push(term);
    }

    sql += ` ORDER BY pack_id NULLS LAST, id LIMIT 100`;

    const { rows } = await dbQuery(sql, params);
    return rows.map(normalize);
  },

  /**
   * Get all sticker packs (distinct pack_id values with their labels).
   */
  async packs() {
    const { rows } = await dbQuery(`
      SELECT DISTINCT pack_id, group_name
      FROM sticker_catalog
      WHERE pack_id IS NOT NULL
      ORDER BY pack_id
    `);
    return rows;
  },

  /**
   * Get all groups with sticker counts.
   */
  async groups() {
    const { rows } = await dbQuery(`
      SELECT group_name, COUNT(*)::int AS count
      FROM sticker_catalog
      GROUP BY group_name
      ORDER BY group_name
    `);
    return rows;
  },

  /**
   * Get stickers placed on a diary workspace for a document.
   */
  async findByDocument(documentId) {
    const { rows } = await dbQuery(
      `SELECT * FROM diary_stickers WHERE document_id = $1 ORDER BY z_index, id`,
      [documentId]
    );
    return rows.map(normalizeDiarySticker);
  },

  /**
   * Place a sticker on a diary workspace.
   */
  async create({ documentId, catalogStickerId, emoji, label, x, y, rotate, scale, zIndex }) {
    const { rows } = await dbQuery(
      `INSERT INTO diary_stickers (document_id, catalog_sticker_id, emoji, label, x, y, rotate, scale, z_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [documentId, catalogStickerId || null, emoji || "⭐", label || "Sticker", x ?? 50, y ?? 50, rotate ?? 0, scale ?? 1.0, zIndex ?? 0]
    );
    return normalizeDiarySticker(rows[0]);
  },

  /**
   * Update a sticker's position/rotation/scale.
   */
  async update(id, { x, y, rotate, scale, zIndex } = {}) {
    const sets = [];
    const params = [];
    let idx = 1;

    if (x !== undefined) { sets.push(`x = $${idx++}`); params.push(x); }
    if (y !== undefined) { sets.push(`y = $${idx++}`); params.push(y); }
    if (rotate !== undefined) { sets.push(`rotate = $${idx++}`); params.push(rotate); }
    if (scale !== undefined) { sets.push(`scale = $${idx++}`); params.push(scale); }
    if (zIndex !== undefined) { sets.push(`z_index = $${idx++}`); params.push(zIndex); }

    if (!sets.length) return null;

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const { rows } = await dbQuery(
      `UPDATE diary_stickers SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    return rows[0] ? normalizeDiarySticker(rows[0]) : null;
  },

  /**
   * Remove a sticker from a diary workspace.
   */
  async remove(id) {
    const { rows } = await dbQuery(
      `DELETE FROM diary_stickers WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] ? normalizeDiarySticker(rows[0]) : null;
  },

  /**
   * Seed the sticker catalog from our data file.
   */
  async seedCatalog(stickers) {
    if (!stickers?.length) return 0;

    let inserted = 0;
    for (const s of stickers) {
      try {
        await dbQuery(
          `INSERT INTO sticker_catalog (id, group_name, label, emoji, tags, pack_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (id) DO NOTHING`,
          [s.id, s.group || "general", s.label || s.emoji, s.emoji || "⭐", JSON.stringify(s.tags || []), s.packId || null]
        );
        inserted++;
      } catch (e) {
        // skip duplicates
      }
    }
    return inserted;
  },
};

function normalize(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    group: row.group_name,
    label: row.label,
    emoji: row.emoji,
    tags: row.tags || [],
    packId: row.pack_id,
    createdAt: row.created_at,
  };
}

function normalizeDiarySticker(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    catalogStickerId: row.catalog_sticker_id,
    emoji: row.emoji,
    label: row.label,
    x: row.x,
    y: row.y,
    rotate: row.rotate,
    scale: row.scale,
    zIndex: row.z_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default Sticker;