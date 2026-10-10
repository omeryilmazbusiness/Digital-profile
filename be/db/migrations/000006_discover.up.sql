-- The Discover part of the site: topics shown in order, each with PDF brochures to read or
-- download. Texts are per interface language; empty strings mean "not provided".
CREATE TABLE discover_sections (
    id         uuid        PRIMARY KEY,
    position   integer     NOT NULL CHECK (position >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER discover_sections_set_updated_at
    BEFORE UPDATE ON discover_sections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE discover_section_translations (
    section_id uuid NOT NULL REFERENCES discover_sections (id) ON DELETE CASCADE,
    locale     text NOT NULL CHECK (locale IN ('id', 'en', 'ar')),
    eyebrow    text NOT NULL DEFAULT '' CHECK (length(eyebrow) <= 60),
    title      text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
    body       text NOT NULL DEFAULT '' CHECK (length(body) <= 3000),
    PRIMARY KEY (section_id, locale)
);

-- A PDF lives in the blob store under storage_key; the row is its catalogue entry.
CREATE TABLE documents (
    id          uuid        PRIMARY KEY,
    section_id  uuid        NOT NULL REFERENCES discover_sections (id) ON DELETE CASCADE,
    position    integer     NOT NULL CHECK (position >= 0),
    -- The language the PDF itself is written in.
    language    text        NOT NULL CHECK (language IN ('id', 'en', 'ar')),
    storage_key text        NOT NULL UNIQUE,
    file_name   text        NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 200),
    byte_size   bigint      NOT NULL CHECK (byte_size > 0),
    page_count  integer     CHECK (page_count > 0),
    sha256      bytea       NOT NULL CHECK (length(sha256) = 32),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_section_id_position_idx ON documents (section_id, position);

CREATE TRIGGER documents_set_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE document_translations (
    document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    locale      text NOT NULL CHECK (locale IN ('id', 'en', 'ar')),
    title       text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
    PRIMARY KEY (document_id, locale)
);

-- Site-wide settings: a single row (id is always 1).
CREATE TABLE site_settings (
    id         smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tour_url   text        NOT NULL DEFAULT '' CHECK (tour_url = '' OR tour_url ~ '^https://'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_settings_set_updated_at
    BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
