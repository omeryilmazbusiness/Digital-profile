-- Case-insensitive text, used for emails and other identifiers compared without case.
CREATE EXTENSION IF NOT EXISTS citext;

-- Shared trigger: keeps updated_at current on every UPDATE.
-- Attach with: CREATE TRIGGER <table>_set_updated_at BEFORE UPDATE ON <table>
--              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END
$$;
