-- Single administrator account. There is no public sign-up; the account is created by the CLI.
CREATE TABLE admin_users (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email               citext      NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
    password_hash       text        NOT NULL,
    password_changed_at timestamptz NOT NULL DEFAULT now(),
    failed_login_count  integer     NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until        timestamptz,
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- At most one row: the product has exactly one admin.
CREATE UNIQUE INDEX admin_users_singleton ON admin_users ((true));

CREATE TRIGGER admin_users_set_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A login creates a session; every refresh token issued for it belongs to the same session
-- (the token "family"). Revoking the session invalidates its refresh and access tokens at once.
CREATE TABLE auth_sessions (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    -- Absolute lifetime; refreshing never extends a session past this point.
    expires_at    timestamptz NOT NULL,
    revoked_at    timestamptz,
    revoke_reason text CHECK (revoke_reason IN ('logout', 'password_changed', 'password_reset', 'refresh_reuse')),
    ip            inet,
    user_agent    text CHECK (length(user_agent) <= 512),
    CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))
);

CREATE INDEX auth_sessions_active_by_user ON auth_sessions (user_id) WHERE revoked_at IS NULL;

-- Refresh tokens are opaque; only their SHA-256 is stored.
CREATE TABLE refresh_tokens (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid        NOT NULL REFERENCES auth_sessions (id) ON DELETE CASCADE,
    token_hash bytea       NOT NULL UNIQUE CHECK (length(token_hash) = 32),
    expires_at timestamptz NOT NULL,
    -- Set when the token is rotated. Presenting a used token again signals theft.
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_session ON refresh_tokens (session_id);

CREATE TABLE auth_audit_events (
    id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    uuid        REFERENCES admin_users (id) ON DELETE SET NULL,
    event      text        NOT NULL CHECK (event IN (
                   'admin_created', 'login_succeeded', 'login_failed', 'login_locked',
                   'account_locked', 'logout', 'refresh_reuse_detected',
                   'password_changed', 'password_change_failed', 'password_reset')),
    -- Attempted address for failed logins against unknown accounts.
    email      citext,
    ip         inet,
    user_agent text CHECK (length(user_agent) <= 512),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_audit_events_created ON auth_audit_events (created_at DESC);
CREATE INDEX auth_audit_events_user ON auth_audit_events (user_id, created_at DESC);
