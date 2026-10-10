-- name: GetSettings :one
SELECT * FROM site_settings WHERE id = 1;

-- name: UpsertSettings :one
INSERT INTO site_settings (id, tour_url)
VALUES (1, @tour_url)
ON CONFLICT (id) DO UPDATE SET tour_url = EXCLUDED.tour_url
RETURNING *;
