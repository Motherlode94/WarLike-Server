-- Each Engine workspace is private by default. Never reuse the legacy global KV 'main' slot.
CREATE TABLE IF NOT EXISTS engine_projects (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES members(id),
 name TEXT NOT NULL,
 project_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 deleted_at INTEGER,
 CHECK(revision>=1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS engine_projects_owner ON engine_projects(owner_id,updated_at DESC);
--> statement-breakpoint
-- Published snapshots are separated from private editable source, even for the owner.
CREATE TABLE IF NOT EXISTS warlike_publications (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES members(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('engine','studio')),
 source_id TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','unlisted','withdrawn')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS warlike_publications_owner ON warlike_publications(owner_id,updated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS warlike_publications_public ON warlike_publications(status,updated_at DESC);

--> statement-breakpoint
-- Separate PKCE codes and revocable Engine access sessions: Studio tokens are not valid here.
CREATE TABLE IF NOT EXISTS engine_pair_codes (
 code_hash TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL REFERENCES members(id),
 challenge TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 used_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS engine_pair_codes_expiry ON engine_pair_codes(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS engine_access_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL REFERENCES members(id),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 revoked_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS engine_access_sessions_member ON engine_access_sessions(member_id);
