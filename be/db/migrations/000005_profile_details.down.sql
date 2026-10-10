ALTER TABLE profile_translations
    DROP COLUMN IF EXISTS country,
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS street,
    DROP COLUMN IF EXISTS display_name;

DROP INDEX IF EXISTS profile_vcard_photo_media_id_idx;

ALTER TABLE profile
    DROP COLUMN IF EXISTS linkedin_url,
    DROP COLUMN IF EXISTS map_url,
    DROP COLUMN IF EXISTS postal_code,
    DROP COLUMN IF EXISTS vcard_photo_media_id;
