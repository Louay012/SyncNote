CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  -- Deprecated for structured editing; retained for backward compatibility.
  content TEXT NOT NULL DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_owner_id_idx ON documents(owner_id);

CREATE TABLE IF NOT EXISTS sections (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sections_type_check CHECK (type IN ('summary', 'notes', 'questions')),
  CONSTRAINT sections_document_type_unique UNIQUE (document_id, type)
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

-- Ensure missing sections are always present for existing documents.
INSERT INTO sections(document_id, type, content)
SELECT
  d.id,
  seed.type,
  CASE
    WHEN seed.type = 'notes' THEN COALESCE(d.content, '')
    ELSE ''
  END
FROM documents d
CROSS JOIN (
  VALUES ('summary'), ('notes'), ('questions')
) AS seed(type)
ON CONFLICT (document_id, type) DO NOTHING;

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
    SET section_id = s.id
    FROM sections s
    WHERE c.section_id IS NULL
      AND s.document_id = c.document_id
      AND s.type = 'notes';
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
