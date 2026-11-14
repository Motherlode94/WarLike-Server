-- Short-lived explicit pairing and opaque revocable Studio sessions.
CREATE TABLE IF NOT EXISTS studio_pair_codes (
 code_hash TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL REFERENCES members(id),
 challenge TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 used_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS studio_pair_codes_expiry ON studio_pair_codes(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS studio_access_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL REFERENCES members(id),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 revoked_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS studio_sessions_member ON studio_access_sessions(member_id);
