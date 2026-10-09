-- The digital business card: one sales manager, so a single row (id is always 1).
-- Contact numbers are stored in E.164 so tel:, wa.me and vCard links never need parsing.
CREATE TABLE profile (
    id                smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    first_name        text        NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 60),
    last_name         text        NOT NULL DEFAULT '' CHECK (length(last_name) <= 60),
    organization      text        NOT NULL DEFAULT '' CHECK (length(organization) <= 120),
    -- NO ACTION: the portrait cannot be deleted from the media library while it is in use.
    portrait_media_id uuid        REFERENCES media (id),
    phone             text        CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
    whatsapp          text        CHECK (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
    email             text        CHECK (length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%'),
    -- ISO 639-1 codes in display order; the allowed set is enforced by the API.
    languages         text[]      NOT NULL DEFAULT '{ar,en,tr}'
                                  CHECK (cardinality(languages) <= 20
                                     AND array_to_string(languages, ',') ~ '^([a-z]{2}(,[a-z]{2})*)?$'),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profile_portrait_media_id_idx ON profile (portrait_media_id);

CREATE TRIGGER profile_set_updated_at
    BEFORE UPDATE ON profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Texts per interface language. Empty strings mean "not provided".
CREATE TABLE profile_translations (
    profile_id       smallint NOT NULL DEFAULT 1 REFERENCES profile (id) ON DELETE CASCADE,
    locale           text     NOT NULL CHECK (locale IN ('id', 'en', 'ar')),
    title            text     NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
    tagline          text     NOT NULL DEFAULT '' CHECK (length(tagline) <= 160),
    bio              text     NOT NULL DEFAULT '' CHECK (length(bio) <= 1000),
    whatsapp_message text     NOT NULL DEFAULT '' CHECK (length(whatsapp_message) <= 500),
    PRIMARY KEY (profile_id, locale)
);
