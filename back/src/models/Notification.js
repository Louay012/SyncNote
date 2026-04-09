import { query } from "../db/postgres.js";

function mapNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    recipientId: String(row.recipient_id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    type: row.type,
    title: row.title,
    message: row.message,
    documentId: row.document_id ? String(row.document_id) : null,
    invitationId: row.invitation_id ? String(row.invitation_id) : null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

const baseSelect = `
  SELECT id, recipient_id, actor_id, type, title, message, document_id, invitation_id, is_read, created_at, read_at
  FROM user_notifications
`;

const DEFAULT_VISIBLE_TYPES = [
  "DOCUMENT_LIKED",
  "INVITE_RECEIVED",
  "INVITE_APPROVED",
  "INVITE_REJECTED"
];

function notificationTypeFilter(startIndex, types = DEFAULT_VISIBLE_TYPES) {
  const safeTypes = Array.isArray(types)
    ? types.filter((type) => typeof type === "string" && type.trim())
    : [];

  if (!safeTypes.length) {
    return {
      sql: "",
      values: []
    };
  }

  const placeholders = safeTypes.map((_, index) => `$${startIndex + index}`);
  return {
    sql: ` AND type IN (${placeholders.join(", ")})`,
    values: safeTypes
  };
}

const Notification = {
  async create({
    recipientId,
    actorId = null,
    type,
    title,
    message = "",
    documentId = null,
    invitationId = null
  }) {
    const { rows } = await query(
      `
        INSERT INTO user_notifications(
          recipient_id,
          actor_id,
          type,
          title,
          message,
          document_id,
          invitation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, recipient_id, actor_id, type, title, message, document_id, invitation_id, is_read, created_at, read_at
      `,
      [recipientId, actorId, type, title, message, documentId, invitationId]
    );

    return mapNotification(rows[0]);
  },

  async findByRecipient(
    recipientId,
    {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      types = DEFAULT_VISIBLE_TYPES
    } = {}
  ) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const unreadSql = unreadOnly ? " AND is_read = false" : "";
    const typeSql = notificationTypeFilter(2, types);
    const baseValues = [recipientId, ...typeSql.values];

    const countResult = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM user_notifications
        WHERE recipient_id = $1${unreadSql}${typeSql.sql}
      `,
      baseValues
    );

    const limitPlaceholder = baseValues.length + 1;
    const offsetPlaceholder = baseValues.length + 2;

    const { rows } = await query(
      `
        ${baseSelect}
        WHERE recipient_id = $1${unreadSql}${typeSql.sql}
        ORDER BY created_at DESC
        LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}
      `,
      [...baseValues, safeLimit, safeOffset]
    );

    return {
      items: rows.map(mapNotification),
      total: Number(countResult.rows[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset
    };
  },

  async markRead(notificationId, recipientId) {
    const { rows } = await query(
      `
        UPDATE user_notifications
        SET is_read = true,
            read_at = COALESCE(read_at, NOW())
        WHERE id = $1
          AND recipient_id = $2
        RETURNING id, recipient_id, actor_id, type, title, message, document_id, invitation_id, is_read, created_at, read_at
      `,
      [notificationId, recipientId]
    );

    return mapNotification(rows[0]);
  }
};

export default Notification;
