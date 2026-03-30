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

  return {
    id: String(row.id),
    text: row.text,
    author: String(row.author_id),
    document: String(row.document_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
