CREATE TABLE warlike_credentials (
  member_id TEXT PRIMARY KEY NOT NULL REFERENCES members(id),
  login TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  verifier TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE warlike_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  credential_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX warlike_sessions_member ON warlike_sessions(member_id);
--> statement-breakpoint
CREATE INDEX warlike_sessions_expiry ON warlike_sessions(expires_at);
