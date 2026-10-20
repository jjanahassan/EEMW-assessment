-- Up Migration

-- ===== Extensions =====
-- pg_trgm enables fuzzy (typo-tolerant) matching and fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===== Enums =====
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');
CREATE TYPE document_visibility AS ENUM ('public', 'restricted');

-- ===== Departments =====
CREATE TABLE departments (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ===== Users =====
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  role          user_role NOT NULL DEFAULT 'employee',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- emails are unique regardless of letter case
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE INDEX users_department_idx ON users (department_id);

-- ===== Documents =====
CREATE TABLE documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description        TEXT,
  uploader_id        UUID NOT NULL REFERENCES users(id),
  visibility         document_visibility NOT NULL DEFAULT 'public',
  current_version_id UUID,                      -- FK added after versions table exists
  download_count     INTEGER NOT NULL DEFAULT 0,
  deleted_at         TIMESTAMPTZ,               -- soft delete (trash)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- auto-maintained full-text search column: title weighs more than description
  search_vector      TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE INDEX documents_search_vector_gin ON documents USING GIN (search_vector);
CREATE INDEX documents_title_trgm_gin    ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX documents_uploader_idx      ON documents (uploader_id);
CREATE INDEX documents_created_at_idx    ON documents (created_at DESC) WHERE deleted_at IS NULL;

-- ===== Versions (history is never deleted) =====
CREATE TABLE document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL CHECK (version_number > 0),
  file_name       TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  change_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
CREATE INDEX document_versions_checksum_idx ON document_versions (checksum_sha256);

-- close the circular reference: documents -> current version
ALTER TABLE documents
  ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

-- ===== Tags (many-to-many) =====
CREATE TABLE tags (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0)
);
CREATE UNIQUE INDEX tags_name_lower_uq ON tags (lower(name));
CREATE INDEX tags_name_trgm_gin ON tags USING GIN (name gin_trgm_ops);

CREATE TABLE document_tags (
  document_id UUID    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);
CREATE INDEX document_tags_tag_idx ON document_tags (tag_id);

-- ===== Permissions: which departments may see a restricted document =====
CREATE TABLE document_permissions (
  document_id   UUID    NOT NULL REFERENCES documents(id)   ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, department_id)
);
CREATE INDEX document_permissions_dept_idx ON document_permissions (department_id);

-- ===== Audit log =====
CREATE TABLE audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID REFERENCES users(id)     ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  action      TEXT  NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_document_idx   ON audit_logs (document_id);
CREATE INDEX audit_logs_user_idx       ON audit_logs (user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);

-- ===== Keep documents.updated_at fresh automatically =====
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
DROP FUNCTION IF EXISTS set_updated_at();
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS document_permissions;
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS tags;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_current_version_fk;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TYPE IF EXISTS document_visibility;
DROP TYPE IF EXISTS user_role;