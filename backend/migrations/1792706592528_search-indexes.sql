-- Up Migration
CREATE INDEX users_name_trgm_gin  ON users USING GIN (name gin_trgm_ops);
CREATE INDEX users_email_trgm_gin ON users USING GIN (email gin_trgm_ops);

-- Down Migration
DROP INDEX IF EXISTS users_email_trgm_gin;
DROP INDEX IF EXISTS users_name_trgm_gin;