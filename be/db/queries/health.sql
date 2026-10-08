-- name: Ping :one
-- Round-trips a statement through the pool; stronger than a bare connection ping.
SELECT 1::int4 AS ok;
