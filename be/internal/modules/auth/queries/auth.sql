-- name: GetAdminByEmail :one
SELECT * FROM admin_users WHERE email = @email;

-- name: GetAdminByID :one
SELECT * FROM admin_users WHERE id = @id;

-- name: CountAdmins :one
SELECT count(*) FROM admin_users;

-- name: CreateAdmin :one
INSERT INTO admin_users (email, password_hash, password_changed_at)
VALUES (@email, @password_hash, @now)
RETURNING *;

-- name: RecordLoginFailure :one
-- Atomic increment, so concurrent failures are all counted.
UPDATE admin_users
SET failed_login_count = LEAST(failed_login_count + 1, 1000)
WHERE id = @id
RETURNING failed_login_count;

-- name: LockAdmin :exec
UPDATE admin_users SET locked_until = @locked_until::timestamptz WHERE id = @id;

-- name: RecordLoginSuccess :exec
UPDATE admin_users
SET failed_login_count = 0, locked_until = NULL, last_login_at = @now::timestamptz
WHERE id = @id;

-- name: UpdatePasswordHash :exec
-- Transparent rehash on login; does not count as a password change.
UPDATE admin_users SET password_hash = @password_hash WHERE id = @id;

-- name: SetPassword :exec
UPDATE admin_users
SET password_hash = @password_hash, password_changed_at = @now,
    failed_login_count = 0, locked_until = NULL
WHERE id = @id;

-- name: CreateSession :one
INSERT INTO auth_sessions (user_id, created_at, last_seen_at, expires_at, ip, user_agent)
VALUES (@user_id, @now, @now, @expires_at, sqlc.narg('ip'), sqlc.narg('user_agent'))
RETURNING *;

-- name: GetActiveSession :one
SELECT * FROM auth_sessions
WHERE id = @id AND user_id = @user_id AND revoked_at IS NULL AND expires_at > @now;

-- name: TouchSession :exec
UPDATE auth_sessions SET last_seen_at = @now WHERE id = @id;

-- name: RevokeSession :exec
UPDATE auth_sessions SET revoked_at = @now::timestamptz, revoke_reason = @reason::text
WHERE id = @id AND revoked_at IS NULL;

-- name: RevokeUserSessions :execrows
UPDATE auth_sessions SET revoked_at = @now::timestamptz, revoke_reason = @reason::text
WHERE user_id = @user_id AND revoked_at IS NULL;

-- name: CreateRefreshToken :exec
INSERT INTO refresh_tokens (session_id, token_hash, expires_at, created_at)
VALUES (@session_id, @token_hash, @expires_at, @now);

-- name: GetRefreshTokenForUpdate :one
-- Row lock serialises concurrent refreshes of the same token.
SELECT
    rt.id, rt.session_id, rt.expires_at, rt.used_at,
    s.user_id, s.expires_at AS session_expires_at, s.revoked_at AS session_revoked_at
FROM refresh_tokens rt
JOIN auth_sessions s ON s.id = rt.session_id
WHERE rt.token_hash = @token_hash
FOR UPDATE OF rt;

-- name: MarkRefreshTokenUsed :exec
UPDATE refresh_tokens SET used_at = @now::timestamptz WHERE id = @id;

-- name: InsertAuditEvent :exec
INSERT INTO auth_audit_events (user_id, event, email, ip, user_agent, created_at)
VALUES (sqlc.narg('user_id'), @event, sqlc.narg('email'), sqlc.narg('ip'), sqlc.narg('user_agent'), @now);

-- name: DeleteExpiredSessions :execrows
-- Housekeeping: sessions that expired or were revoked before @before can never be used again.
-- The retention window keeps recently revoked refresh tokens around for reuse detection.
DELETE FROM auth_sessions WHERE expires_at < @before OR revoked_at < @before;
