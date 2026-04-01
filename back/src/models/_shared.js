export function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    password: row.password,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapDocument(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    owner: String(row.owner_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapComment(row) {
  if (!row) {
    return null;
  }

  const mapped = {
    id: String(row.id),
    text: row.text,
    content: row.text,
    author: String(row.author_id),
    section: row.section_id ? String(row.section_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  if (row.document_id !== undefined && row.document_id !== null) {
    mapped.document = String(row.document_id);
  }

  return mapped;
}

export function mapSection(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    documentId: String(row.document_id),
    document: String(row.document_id),
    title: row.title,
    parentId: row.parent_id !== null && row.parent_id !== undefined ? String(row.parent_id) : null,
    order: Number(row.order_index || 0),
    type: row.type,
    content: row.content,
    updatedById: row.updated_by_id ? String(row.updated_by_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapVersion(row) {
  if (!row) {
    return null;
  }

  const snapshotValue =
    typeof row.snapshot === "string" ? row.snapshot : JSON.stringify(row.snapshot);

  return {
    id: String(row.id),
    documentId: String(row.document_id),
    snapshot: snapshotValue,
    snapshotRaw: row.snapshot,
    createdBy: String(row.created_by),
    createdAt: row.created_at
  };
}

export function mapShare(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    document: String(row.document_id),
    user: String(row.user_id),
    permission: row.permission,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
