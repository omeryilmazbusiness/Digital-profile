-- Uploaded images. The original file is never stored: only re-encoded WebP variants, so no
-- EXIF/GPS data or hidden payload survives an upload.
--
-- Usage tracking: tables that use an image reference media(id) with the default
-- ON DELETE NO ACTION. Deleting an image that is still in use then fails with a foreign key
-- violation, which the media service reports as 409 Conflict.
CREATE TABLE media (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- SHA-256 of the uploaded bytes: identical re-uploads return the existing image.
    checksum          bytea       NOT NULL UNIQUE CHECK (length(checksum) = 32),
    original_filename text        NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
    source_type       text        NOT NULL CHECK (source_type IN ('image/jpeg', 'image/png', 'image/webp')),
    source_bytes      bigint      NOT NULL CHECK (source_bytes > 0),
    -- Display dimensions, after applying EXIF orientation.
    width             integer     NOT NULL CHECK (width > 0),
    height            integer     NOT NULL CHECK (height > 0),
    -- Tiny blurred WebP data URI shown while the real image loads.
    placeholder       text        NOT NULL CHECK (length(placeholder) <= 4096),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Keyset pagination for the media library, newest first.
CREATE INDEX media_created_at_id_idx ON media (created_at DESC, id DESC);

CREATE TRIGGER media_set_updated_at
    BEFORE UPDATE ON media
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Responsive renditions. Keys are content hashes, so a URL always names the same bytes and
-- can be cached forever.
CREATE TABLE media_variants (
    media_id     uuid    NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    width        integer NOT NULL CHECK (width > 0),
    height       integer NOT NULL CHECK (height > 0),
    storage_key  text    NOT NULL UNIQUE CHECK (storage_key ~ '^media/[0-9a-f]{64}\.webp$'),
    content_type text    NOT NULL DEFAULT 'image/webp' CHECK (content_type = 'image/webp'),
    byte_size    bigint  NOT NULL CHECK (byte_size > 0),
    PRIMARY KEY (media_id, width)
);

-- Alternative text per interface language.
CREATE TABLE media_translations (
    media_id uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    locale   text NOT NULL CHECK (locale IN ('id', 'en', 'ar')),
    alt_text text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 1 AND 300),
    PRIMARY KEY (media_id, locale)
);
