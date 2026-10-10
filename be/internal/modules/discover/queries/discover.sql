-- name: ListSections :many
SELECT * FROM discover_sections ORDER BY position, created_at;

-- name: GetSection :one
SELECT * FROM discover_sections WHERE id = @id;

-- name: LockSections :many
-- Serialises writers that renumber positions.
SELECT id FROM discover_sections ORDER BY position, created_at FOR UPDATE;

-- name: CreateSection :one
INSERT INTO discover_sections (id, position)
VALUES (@id, (SELECT COALESCE(MAX(position) + 1, 0) FROM discover_sections))
RETURNING *;

-- name: TouchSection :exec
UPDATE discover_sections SET updated_at = now() WHERE id = @id;

-- name: SetSectionPosition :exec
UPDATE discover_sections SET position = @position WHERE id = @id;

-- name: DeleteSection :execrows
DELETE FROM discover_sections WHERE id = @id;

-- name: ListSectionTranslations :many
SELECT * FROM discover_section_translations ORDER BY section_id, locale;

-- name: DeleteSectionTranslations :exec
DELETE FROM discover_section_translations WHERE section_id = @section_id;

-- name: CreateSectionTranslation :exec
INSERT INTO discover_section_translations (section_id, locale, eyebrow, title, body)
VALUES (@section_id, @locale, @eyebrow, @title, @body);

-- name: ListDocuments :many
SELECT * FROM documents ORDER BY section_id, position, created_at;

-- name: ListSectionStorageKeys :many
SELECT storage_key FROM documents WHERE section_id = @section_id;

-- name: GetDocument :one
SELECT * FROM documents WHERE id = @id;

-- name: LockDocument :one
SELECT * FROM documents WHERE id = @id FOR UPDATE;

-- name: CreateDocument :one
INSERT INTO documents (id, section_id, position, language, storage_key, file_name, byte_size, page_count, sha256)
VALUES (
    @id, @section_id,
    (SELECT COALESCE(MAX(position) + 1, 0) FROM documents WHERE section_id = @section_id),
    @language, @storage_key, @file_name, @byte_size, @page_count, @sha256
)
RETURNING *;

-- name: UpdateDocumentLanguage :exec
UPDATE documents SET language = @language WHERE id = @id;

-- name: ReplaceDocumentFile :exec
UPDATE documents
SET storage_key = @storage_key, file_name = @file_name, byte_size = @byte_size,
    page_count = @page_count, sha256 = @sha256
WHERE id = @id;

-- name: DeleteDocument :execrows
DELETE FROM documents WHERE id = @id;

-- name: ListDocumentTranslations :many
SELECT * FROM document_translations ORDER BY document_id, locale;

-- name: DeleteDocumentTranslations :exec
DELETE FROM document_translations WHERE document_id = @document_id;

-- name: CreateDocumentTranslation :exec
INSERT INTO document_translations (document_id, locale, title)
VALUES (@document_id, @locale, @title);
