CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_at_idx
ON email_verification_tokens(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  -- Deprecated for structured editing; retained for backward compatibility.
  content TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS documents_owner_id_idx ON documents(owner_id);

CREATE TABLE IF NOT EXISTS sections (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Section',
  content TEXT NOT NULL DEFAULT '',
  content_doc JSONB,
  parent_id BIGINT REFERENCES sections(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- Deprecated: retained only for compatibility with older snapshots/migrations.
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sections_document_id_idx ON sections(document_id);

CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS versions_document_id_idx ON versions(document_id);
CREATE INDEX IF NOT EXISTS versions_created_by_idx ON versions(created_by);

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shares (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'EDIT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shares_permission_check CHECK (permission IN ('VIEW', 'EDIT')),
  CONSTRAINT shares_document_user_unique UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS shares_user_id_idx ON shares(user_id);
CREATE INDEX IF NOT EXISTS shares_document_id_idx ON shares(document_id);

CREATE TABLE IF NOT EXISTS document_likes (
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS document_likes_user_id_idx ON document_likes(user_id);
CREATE INDEX IF NOT EXISTS document_likes_document_id_idx ON document_likes(document_id);

CREATE TABLE IF NOT EXISTS collaboration_invitations (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  inviter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'EDIT',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT collaboration_invites_permission_check CHECK (permission IN ('VIEW', 'EDIT')),
  CONSTRAINT collaboration_invites_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT collaboration_invites_document_user_unique UNIQUE (document_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS collaboration_invitations_invitee_id_idx ON collaboration_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS collaboration_invitations_document_id_idx ON collaboration_invitations(document_id);

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  invitation_id BIGINT REFERENCES collaboration_invitations(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT user_notifications_type_check CHECK (
    type IN ('DOCUMENT_EDITED', 'DOCUMENT_LIKED', 'INVITE_RECEIVED', 'INVITE_APPROVED', 'INVITE_REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS user_notifications_recipient_id_idx ON user_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS user_notifications_recipient_unread_idx ON user_notifications(recipient_id, is_read, created_at DESC);

ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
ALTER TABLE user_notifications
ADD CONSTRAINT user_notifications_type_check CHECK (
  type IN ('DOCUMENT_EDITED', 'DOCUMENT_LIKED', 'INVITE_RECEIVED', 'INVITE_APPROVED', 'INVITE_REJECTED')
);

-- Dynamic section migration and compatibility layer.
ALTER TABLE sections ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS parent_id BIGINT;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS content_doc JSONB;

CREATE OR REPLACE FUNCTION try_parse_jsonb(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN input_text::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

ALTER TABLE sections
ALTER COLUMN content_doc
SET DEFAULT '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb;

UPDATE sections s
SET content_doc = COALESCE(
  CASE
    WHEN try_parse_jsonb(s.content) IS NOT NULL
      AND try_parse_jsonb(s.content)->>'type' = 'doc'
      AND jsonb_typeof(try_parse_jsonb(s.content)->'content') = 'array'
    THEN try_parse_jsonb(s.content)
    ELSE NULL
  END,
  jsonb_build_object(
    'type', 'doc',
    'content', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', line)
            )
          )
        )
        FROM unnest(regexp_split_to_array(COALESCE(s.content, ''), E'\\n')) AS line
      ),
      '[]'::jsonb
    )
  )
)
WHERE s.content_doc IS NULL;

ALTER TABLE sections ALTER COLUMN content_doc SET NOT NULL;
CREATE INDEX IF NOT EXISTS sections_content_doc_idx ON sections USING GIN (content_doc);

ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_type_check;
ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_document_type_unique;

ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_parent_id_fkey;
ALTER TABLE sections
ADD CONSTRAINT sections_parent_id_fkey
FOREIGN KEY (parent_id) REFERENCES sections(id) ON DELETE CASCADE;

ALTER TABLE sections ALTER COLUMN type DROP NOT NULL;

UPDATE sections
SET title = COALESCE(NULLIF(TRIM(title), ''), INITCAP(COALESCE(type, 'section')));

UPDATE sections
SET title = 'Section'
WHERE title IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY document_id, COALESCE(parent_id, 0)
      ORDER BY created_at, id
    ) - 1 AS next_order
  FROM sections
)
UPDATE sections s
SET order_index = ranked.next_order
FROM ranked
WHERE s.id = ranked.id;

ALTER TABLE sections ALTER COLUMN title SET NOT NULL;

CREATE INDEX IF NOT EXISTS sections_parent_id_idx ON sections(parent_id);
CREATE INDEX IF NOT EXISTS sections_document_parent_order_idx
ON sections(document_id, parent_id, order_index);

-- Ensure each document has at least one root section.
INSERT INTO sections(document_id, title, content, content_doc, parent_id, order_index, type)
SELECT
  d.id,
  'Overview',
  COALESCE(d.content, ''),
  COALESCE(
    CASE
      WHEN try_parse_jsonb(d.content) IS NOT NULL
        AND try_parse_jsonb(d.content)->>'type' = 'doc'
        AND jsonb_typeof(try_parse_jsonb(d.content)->'content') = 'array'
      THEN try_parse_jsonb(d.content)
      ELSE NULL
    END,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', COALESCE(d.content, ''))
          )
        )
      )
    )
  ),
  NULL,
  0,
  'notes'
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM sections s WHERE s.document_id = d.id
);

-- Migration path for existing comments linked by document_id.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS section_id BIGINT;
CREATE INDEX IF NOT EXISTS comments_section_id_idx ON comments(section_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'comments'
      AND column_name = 'document_id'
  ) THEN
    UPDATE comments c
    SET section_id = COALESCE(
      (
        SELECT s1.id
        FROM sections s1
        WHERE s1.document_id = c.document_id
          AND s1.type = 'notes'
        ORDER BY s1.id
        LIMIT 1
      ),
      (
        SELECT s2.id
        FROM sections s2
        WHERE s2.document_id = c.document_id
        ORDER BY s2.parent_id NULLS FIRST, s2.order_index, s2.id
        LIMIT 1
      )
    )
    WHERE c.section_id IS NULL
      AND c.document_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_section_id_fkey;
ALTER TABLE comments
ADD CONSTRAINT comments_section_id_fkey
FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

ALTER TABLE comments ALTER COLUMN section_id SET NOT NULL;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_document_id_fkey;
DROP INDEX IF EXISTS comments_document_id_idx;
ALTER TABLE comments DROP COLUMN IF EXISTS document_id;

-- Yjs snapshot storage: store latest encoded Yjs snapshot per document and history
CREATE TABLE IF NOT EXISTS document_snapshots (
  document_id BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_snapshots_history (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  saved_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_snapshots_history_document_id_idx ON document_snapshots_history(document_id);
