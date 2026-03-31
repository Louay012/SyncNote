import { query } from "../db/postgres.js";
import { mapSection } from "./_shared.js";

export const SECTION_TYPES = ["summary", "notes", "questions"];

function normalizeSectionType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!SECTION_TYPES.includes(normalized)) {
    throw new Error("Section type must be summary, notes, or questions");
  }
  return normalized;
}

const Section = {
  normalizeType: normalizeSectionType,

  async ensureDefaults(documentId, notesContent = "") {
    await query(
      `
        INSERT INTO sections(document_id, type, content)
        VALUES
          ($1, 'summary', ''),
          ($1, 'notes', $2),
          ($1, 'questions', '')
        ON CONFLICT (document_id, type) DO NOTHING
      `,
      [documentId, String(notesContent || "")]
    );

    return this.findByDocumentId(documentId);
  },

  async findById(id) {
    const { rows } = await query(
      `
        SELECT id, document_id, type, content, created_at, updated_at
        FROM sections
        WHERE id = $1
      `,
      [id]
    );

    return mapSection(rows[0]);
  },

  async findByDocumentId(documentId) {
    const { rows } = await query(
      `
        SELECT id, document_id, type, content, created_at, updated_at
        FROM sections
        WHERE document_id = $1
        ORDER BY CASE type
          WHEN 'summary' THEN 1
          WHEN 'notes' THEN 2
          WHEN 'questions' THEN 3
          ELSE 4
        END
      `,
      [documentId]
    );

    return rows.map(mapSection);
  },

  async findByDocumentAndType(documentId, type) {
    const normalizedType = normalizeSectionType(type);
    const { rows } = await query(
      `
        SELECT id, document_id, type, content, created_at, updated_at
        FROM sections
        WHERE document_id = $1 AND type = $2
        LIMIT 1
      `,
      [documentId, normalizedType]
    );

    return mapSection(rows[0]);
  },

  async updateContent(id, content) {
    const { rows } = await query(
      `
        UPDATE sections
        SET content = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, document_id, type, content, created_at, updated_at
      `,
      [String(content || ""), id]
    );

    return mapSection(rows[0]);
  },

  async snapshotForDocument(documentId) {
    const sections = await this.findByDocumentId(documentId);
    const snapshot = {
      summary: "",
      notes: "",
      questions: ""
    };

    for (const section of sections) {
      if (SECTION_TYPES.includes(section.type)) {
        snapshot[section.type] = section.content;
      }
    }

    return snapshot;
  },

  async applySnapshot(documentId, snapshot = {}) {
    const contentByType = {
      summary: typeof snapshot.summary === "string" ? snapshot.summary : "",
      notes: typeof snapshot.notes === "string" ? snapshot.notes : "",
      questions: typeof snapshot.questions === "string" ? snapshot.questions : ""
    };

    const updatedSections = [];

    for (const type of SECTION_TYPES) {
      const { rows } = await query(
        `
          INSERT INTO sections(document_id, type, content)
          VALUES ($1, $2, $3)
          ON CONFLICT (document_id, type)
          DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
          RETURNING id, document_id, type, content, created_at, updated_at
        `,
        [documentId, type, contentByType[type]]
      );

      updatedSections.push(mapSection(rows[0]));
    }

    return updatedSections;
  }
};

export default Section;
