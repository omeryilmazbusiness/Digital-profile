-- name: CreateMedia :one
INSERT INTO media (checksum, original_filename, source_type, source_bytes, width, height, placeholder)
VALUES (@checksum, @original_filename, @source_type, @source_bytes, @width, @height, @placeholder)
RETURNING *;

-- name: CreateVariant :exec
INSERT INTO media_variants (media_id, width, height, storage_key, byte_size)
VALUES (@media_id, @width, @height, @storage_key, @byte_size);

-- name: GetMedia :one
SELECT * FROM media WHERE id = @id;

-- name: GetMediaByChecksum :one
SELECT * FROM media WHERE checksum = @checksum;

-- name: ListMedia :many
-- Keyset pagination: pass the last row's (created_at, id) to get the next page.
SELECT * FROM media
WHERE sqlc.narg(after_created_at)::timestamptz IS NULL
   OR (created_at, id) < (sqlc.narg(after_created_at)::timestamptz, sqlc.narg(after_id)::uuid)
ORDER BY created_at DESC, id DESC
LIMIT @page_size;

-- name: ListVariants :many
SELECT * FROM media_variants WHERE media_id = ANY(@media_ids::uuid[]) ORDER BY media_id, width;

-- name: ListTranslations :many
SELECT * FROM media_translations WHERE media_id = ANY(@media_ids::uuid[]) ORDER BY media_id, locale;

-- name: DeleteTranslations :exec
DELETE FROM media_translations WHERE media_id = @media_id;

-- name: CreateTranslation :exec
INSERT INTO media_translations (media_id, locale, alt_text) VALUES (@media_id, @locale, @alt_text);

-- name: TouchMedia :execrows
UPDATE media SET updated_at = now() WHERE id = @id;

-- name: DeleteMedia :execrows
DELETE FROM media WHERE id = @id;

-- name: LockMedia :one
-- Locks the row so the variant lookup and the delete see the same state.
SELECT id FROM media WHERE id = @id FOR UPDATE;

-- name: GetVariantByKey :one
SELECT storage_key, content_type, byte_size FROM media_variants WHERE storage_key = @storage_key;
