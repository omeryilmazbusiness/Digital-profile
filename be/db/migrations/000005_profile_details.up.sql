-- Where to find the sales manager and the picture saved with the contact card.
ALTER TABLE profile
    -- NO ACTION, like the portrait: the image stays in the library while the card uses it.
    ADD COLUMN vcard_photo_media_id uuid REFERENCES media (id),
    ADD COLUMN postal_code  text NOT NULL DEFAULT '' CHECK (length(postal_code) <= 20),
    ADD COLUMN map_url      text NOT NULL DEFAULT '' CHECK (map_url = '' OR map_url ~ '^https://'),
    ADD COLUMN linkedin_url text NOT NULL DEFAULT '' CHECK (linkedin_url = '' OR linkedin_url ~ '^https://');

CREATE INDEX profile_vcard_photo_media_id_idx ON profile (vcard_photo_media_id);

-- The name as written in each language (e.g. Arabic script) and the address in parts.
ALTER TABLE profile_translations
    ADD COLUMN display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 120),
    ADD COLUMN street       text NOT NULL DEFAULT '' CHECK (length(street) <= 200),
    ADD COLUMN city         text NOT NULL DEFAULT '' CHECK (length(city) <= 80),
    ADD COLUMN country      text NOT NULL DEFAULT '' CHECK (length(country) <= 80);
