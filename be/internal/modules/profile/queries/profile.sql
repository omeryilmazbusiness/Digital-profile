-- name: GetProfile :one
SELECT * FROM profile WHERE id = 1;

-- name: UpsertProfile :one
INSERT INTO profile (
    id, first_name, last_name, organization, portrait_media_id, vcard_photo_media_id,
    phone, whatsapp, email, languages, postal_code, map_url, linkedin_url
)
VALUES (
    1, @first_name, @last_name, @organization, @portrait_media_id, @vcard_photo_media_id,
    @phone, @whatsapp, @email, @languages::text[], @postal_code, @map_url, @linkedin_url
)
ON CONFLICT (id) DO UPDATE SET
    first_name           = EXCLUDED.first_name,
    last_name            = EXCLUDED.last_name,
    organization         = EXCLUDED.organization,
    portrait_media_id    = EXCLUDED.portrait_media_id,
    vcard_photo_media_id = EXCLUDED.vcard_photo_media_id,
    phone                = EXCLUDED.phone,
    whatsapp             = EXCLUDED.whatsapp,
    email                = EXCLUDED.email,
    languages            = EXCLUDED.languages,
    postal_code          = EXCLUDED.postal_code,
    map_url              = EXCLUDED.map_url,
    linkedin_url         = EXCLUDED.linkedin_url
RETURNING *;

-- name: ListTranslations :many
SELECT * FROM profile_translations WHERE profile_id = 1 ORDER BY locale;

-- name: DeleteTranslations :exec
DELETE FROM profile_translations WHERE profile_id = 1;

-- name: CreateTranslation :exec
INSERT INTO profile_translations (
    profile_id, locale, title, tagline, bio, whatsapp_message, display_name, street, city, country
)
VALUES (
    1, @locale, @title, @tagline, @bio, @whatsapp_message, @display_name, @street, @city, @country
);
