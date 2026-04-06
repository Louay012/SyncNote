import { query } from "../db/postgres.js";
import { mapSection } from "./_shared.js";

const baseSelect = `
  SELECT id, document_id, title, content, content_doc, parent_id, order_index, type, created_at, updated_at
  FROM sections
`;

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }]
};

function normalizeTitle(title) {
  const value = String(title || "").trim();
  if (!value) {
    throw new Error("Section title is required");
  }

  if (value.length > 120) {
    throw new Error("Section title is too long");
  }

  return value;
}

function normalizeLegacyText(value) {
  const text = String(value ?? "");
  if (text.length > 100_000) {
    throw new Error("Section content is too long");
  }
  return text;
}

function isDocNode(value) {
  return (
    value &&
    typeof value === "object" &&
    value.type === "doc" &&
    Array.isArray(value.content)
  );
}

function legacyTextToDoc(value) {
  const lines = String(value ?? "").split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : []
    }))
  };
}

function docToLegacyText(doc) {
  if (!isDocNode(doc)) {
    return "";
  }

  const lines = (doc.content || []).map((paragraph) => {
    if (!paragraph || paragraph.type !== "paragraph") {
      return "";
    }

    const content = Array.isArray(paragraph.content) ? paragraph.content : [];
    return content.map((node) => String(node?.text || "")).join("");
  });

  return normalizeLegacyText(lines.join("\n"));
}

function normalizeRichContent(content) {
  if (typeof content === "object" && content !== null) {
    if (!isDocNode(content)) {
      throw new Error("Section content must be a valid rich text document");
    }

    return {
      contentDoc: content,
      contentText: docToLegacyText(content)
    };
  }

  const value = String(content ?? "");
  if (!value.trim()) {
    return {
      contentDoc: EMPTY_DOC,
      contentText: ""
    };
  }

  try {
    const parsed = JSON.parse(value);
    if (isDocNode(parsed)) {
      return {
        contentDoc: parsed,
        contentText: docToLegacyText(parsed)
      };
    }
  } catch {
    // Plain text fallback.
  }

  return {
    contentDoc: legacyTextToDoc(value),
    contentText: normalizeLegacyText(value)
  };
}

function normalizeOrder(order) {
  const parsed = Number(order);
  if (!Number.isFinite(parsed)) {
    throw new Error("Order must be a number");
  }

  return Math.max(Math.trunc(parsed), 0);
}

async function getSiblingIds(documentId, parentId) {
  const { rows } = await query(
    `
      SELECT id
      FROM sections
      WHERE document_id = $1
        AND parent_id IS NOT DISTINCT FROM $2
      ORDER BY order_index, id
    `,
    [documentId, parentId]
  );

  return rows.map((row) => String(row.id));
}

const Section = {
  async ensureDefaults(documentId, initialContent = "") {
    const countResult = await query(
      "SELECT COUNT(*)::int AS total FROM sections WHERE document_id = $1",
      [documentId]
    );

    const total = Number(countResult.rows[0]?.total || 0);
    const normalized = normalizeRichContent(initialContent);

    if (total === 0) {
      await query(
        `
          INSERT INTO sections(document_id, title, content, content_doc, parent_id, order_index, type)
          VALUES ($1, 'Overview', $2, $3::jsonb, NULL, 0, 'notes')
        `,
        [documentId, normalized.contentText, normalized.contentDoc]
      );
    }

    return this.findByDocumentId(documentId);
  },

  async findById(id) {
    const { rows } = await query(
      `${baseSelect} WHERE id = $1`,
      [id]
    );

    return mapSection(rows[0]);
  },

  async findByIds(ids = []) {
    if (!ids.length) {
      return [];
    }

    const { rows } = await query(
      `${baseSelect} WHERE id = ANY($1::bigint[])`,
      [ids]
    );

    return rows.map(mapSection);
  },

  async findByDocumentId(documentId) {
    const { rows } = await query(
      `
        ${baseSelect}
        WHERE document_id = $1
        ORDER BY COALESCE(parent_id, id), parent_id NULLS FIRST, order_index, id
      `,
      [documentId]
    );

    return rows.map(mapSection);
  },

  async findByDocumentIds(documentIds = []) {
    if (!documentIds.length) {
      return [];
    }

    const { rows } = await query(
      `
        ${baseSelect}
        WHERE document_id = ANY($1::bigint[])
        ORDER BY document_id, COALESCE(parent_id, id), parent_id NULLS FIRST, order_index, id
      `,
      [documentIds]
    );

    return rows.map(mapSection);
  },

  async findByDocumentAndType(documentId, type) {
    const { rows } = await query(
      `
        ${baseSelect}
        WHERE document_id = $1
          AND type = $2
        ORDER BY order_index, id
        LIMIT 1
      `,
      [documentId, String(type || "")]
    );

    return mapSection(rows[0]);
  },

  async create({ documentId, title, parentId = null, content = "" }) {
    const safeTitle = normalizeTitle(title);
    const normalizedContent = normalizeRichContent(content);
    let safeParentId = parentId;

    if (safeParentId !== null && safeParentId !== undefined) {
      const parent = await this.findById(safeParentId);
      if (!parent) {
        throw new Error("Parent section not found");
      }

      if (String(parent.documentId) !== String(documentId)) {
        throw new Error("Parent section belongs to a different document");
      }

      if (parent.parentId !== null) {
        throw new Error("Cannot create subsection under another subsection");
      }

      safeParentId = parent.id;
    } else {
      safeParentId = null;
    }

    const siblingResult = await query(
      `
        SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order
        FROM sections
        WHERE document_id = $1
          AND parent_id IS NOT DISTINCT FROM $2
      `,
      [documentId, safeParentId]
    );

    const nextOrder = Number(siblingResult.rows[0]?.next_order || 0);

    const { rows } = await query(
      `
        INSERT INTO sections(document_id, title, content, content_doc, parent_id, order_index)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        RETURNING id, document_id, title, content, content_doc, parent_id, order_index, type, created_at, updated_at
      `,
      [
        documentId,
        safeTitle,
        normalizedContent.contentText,
        normalizedContent.contentDoc,
        safeParentId,
        nextOrder
      ]
    );

    return mapSection(rows[0]);
  },

  async updateById(id, updates = {}) {
    const values = [];
    const sets = [];

    if (Object.hasOwn(updates, "title")) {
      values.push(normalizeTitle(updates.title));
      sets.push(`title = $${values.length}`);
    }

    if (Object.hasOwn(updates, "content")) {
      const normalizedContent = normalizeRichContent(updates.content);
      values.push(normalizedContent.contentText);
      sets.push(`content = $${values.length}`);
      values.push(normalizedContent.contentDoc);
      sets.push(`content_doc = $${values.length}::jsonb`);
    }

    if (Object.hasOwn(updates, "order")) {
      values.push(normalizeOrder(updates.order));
      sets.push(`order_index = $${values.length}`);
    }

    if (!sets.length) {
      return this.findById(id);
    }

    values.push(id);

    const { rows } = await query(
      `
        UPDATE sections
        SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, document_id, title, content, content_doc, parent_id, order_index, type, created_at, updated_at
      `,
      values
    );

    return mapSection(rows[0]);
  },

  async updateContent(id, content) {
    return this.updateById(id, { content });
  },

  async rename(id, title) {
    return this.updateById(id, { title });
  },

  async deleteById(id) {
    const { rows } = await query(
      `
        DELETE FROM sections
        WHERE id = $1
        RETURNING id, document_id, title, content, content_doc, parent_id, order_index, type, created_at, updated_at
      `,
      [id]
    );

    return mapSection(rows[0]);
  },

  async reorder(id, targetOrder) {
    const section = await this.findById(id);
    if (!section) {
      return null;
    }

    const siblingIds = await getSiblingIds(section.documentId, section.parentId);
    const currentIndex = siblingIds.indexOf(String(id));
    if (currentIndex === -1) {
      return section;
    }

    const boundedTarget = Math.min(
      Math.max(normalizeOrder(targetOrder), 0),
      siblingIds.length - 1
    );

    if (boundedTarget === currentIndex) {
      return section;
    }

    siblingIds.splice(currentIndex, 1);
    siblingIds.splice(boundedTarget, 0, String(id));

    for (let index = 0; index < siblingIds.length; index += 1) {
      await query(
        `
          UPDATE sections
          SET order_index = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [index, siblingIds[index]]
      );
    }

    return this.findById(id);
  },

  async snapshotForDocument(documentId) {
    const sections = await this.findByDocumentId(documentId);

    return {
      sections: sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content,
        parentId: section.parentId,
        order: section.order
      }))
    };
  },

  async applySnapshot(documentId, snapshot = {}) {
    const snapshotSections = Array.isArray(snapshot.sections)
      ? snapshot.sections
      : [
          { title: "Summary", content: String(snapshot.summary || ""), parentId: null, order: 0 },
          { title: "Notes", content: String(snapshot.notes || ""), parentId: null, order: 1 },
          { title: "Questions", content: String(snapshot.questions || ""), parentId: null, order: 2 }
        ];

    await query("DELETE FROM sections WHERE document_id = $1", [documentId]);

    const roots = snapshotSections
      .filter((item) => !item.parentId)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const idMap = new Map();

    for (const root of roots) {
      const created = await this.create({
        documentId,
        title: root.title || "Section",
        parentId: null,
        content: root.content || ""
      });

      await this.updateById(created.id, { order: Number(root.order || 0) });
      if (root.id !== undefined && root.id !== null) {
        idMap.set(String(root.id), created.id);
      }
    }

    const children = snapshotSections
      .filter((item) => item.parentId)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    for (const child of children) {
      const mappedParentId = idMap.get(String(child.parentId));
      if (!mappedParentId) {
        continue;
      }

      const created = await this.create({
        documentId,
        title: child.title || "Subsection",
        parentId: mappedParentId,
        content: child.content || ""
      });

      await this.updateById(created.id, { order: Number(child.order || 0) });
      if (child.id !== undefined && child.id !== null) {
        idMap.set(String(child.id), created.id);
      }
    }

    return this.findByDocumentId(documentId);
  }
};

export default Section;
