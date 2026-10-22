-- Up Migration
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  -- only the download counter changed: not an edit, leave updated_at alone
  IF to_jsonb(NEW) - 'download_count' - 'updated_at' = to_jsonb(OLD) - 'download_count' - 'updated_at' THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;