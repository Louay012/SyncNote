import { query } from "../db/postgres.js";

function mapInvitation(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    documentId: String(row.document_id),
    inviterId: String(row.inviter_id),
    inviteeId: String(row.invitee_id),
    permission: row.permission,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at
  };
}

const baseSelect = `
  SELECT id, document_id, inviter_id, invitee_id, permission, status, created_at, updated_at, responded_at
  FROM collaboration_invitations
`;

const Invitation = {
  async findById(id) {
    const { rows } = await query(`${baseSelect} WHERE id = $1`, [id]);
    return mapInvitation(rows[0]);
  },

  async findByIds(ids = []) {
    if (!ids.length) {
      return [];
    }

    const { rows } = await query(
      `${baseSelect} WHERE id = ANY($1::bigint[])`,
      [ids]
    );

    return rows.map(mapInvitation);
  },

  async upsertPending({ documentId, inviterId, inviteeId, permission }) {
    const { rows } = await query(
      `
        INSERT INTO collaboration_invitations(
          document_id,
          inviter_id,
          invitee_id,
          permission,
          status
        )
        VALUES ($1, $2, $3, $4, 'PENDING')
        ON CONFLICT (document_id, invitee_id)
        DO UPDATE
        SET inviter_id = EXCLUDED.inviter_id,
            permission = EXCLUDED.permission,
            status = 'PENDING',
            updated_at = NOW(),
            responded_at = NULL
        RETURNING id, document_id, inviter_id, invitee_id, permission, status, created_at, updated_at, responded_at
      `,
      [documentId, inviterId, inviteeId, permission]
    );

    return mapInvitation(rows[0]);
  },

  async findByInvitee(inviteeId, { status } = {}) {
    const values = [inviteeId];
    let whereSql = "invitee_id = $1";

    if (status) {
      values.push(status);
      whereSql += ` AND status = $${values.length}`;
    }

    const { rows } = await query(
      `${baseSelect} WHERE ${whereSql} ORDER BY created_at DESC`,
      values
    );

    return rows.map(mapInvitation);
  },

  async respond({ invitationId, inviteeId, status }) {
    const { rows } = await query(
      `
        UPDATE collaboration_invitations
        SET status = $3,
            responded_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND invitee_id = $2
          AND status = 'PENDING'
        RETURNING id, document_id, inviter_id, invitee_id, permission, status, created_at, updated_at, responded_at
      `,
      [invitationId, inviteeId, status]
    );

    return mapInvitation(rows[0]);
  }
};

export default Invitation;
