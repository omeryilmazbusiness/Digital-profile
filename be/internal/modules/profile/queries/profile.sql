-- name: GetProfile :one
SELECT * FROM profile WHERE id = 1;

-- name: UpsertProfile :one
INSERT INTO profile (id, first_name, last_name, organization, portrait_media_id, phone, whatsapp, email, languages)
VALUES (1, @first_name, @last_name, @organization, @portrait_media_id, @phone, @whatsapp, @email, @languages::text[])
ON CONFLICT (id) DO UPDATE SET
    first_name        = EXCLUDED.first_name,
    last_name         = EXCLUDED.last_name,
    organization      = EXCLUDED.organization,
    portrait_media_id = EXCLUDED.portrait_media_id,
    phone             = EXCLUDED.phone,
    whatsapp          = EXCLUDED.whatsapp,
    email             = EXCLUDED.email,
    languages         = EXCLUDED.languages
RETURNING *;

-- name: ListTranslations :many
SELECT * FROM profile_translations WHERE profile_id = 1 ORDER BY locale;

-- name: DeleteTranslations :exec
DELETE FROM profile_translations WHERE profile_id = 1;

-- name: CreateTranslation :exec
INSERT INTO profile_translations (profile_id, locale, title, tagline, bio, whatsapp_message)
VALUES (1, @locale, @title, @tagline, @bio, @whatsapp_message);
