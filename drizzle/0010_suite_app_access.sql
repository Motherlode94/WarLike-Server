-- Additive, repeatable migration. No existing account, project or session is rewritten.
CREATE TABLE IF NOT EXISTS app_memberships (
 app_id TEXT NOT NULL CHECK(app_id IN ('academy','business')),
 member_id TEXT NOT NULL REFERENCES members(id),
 role TEXT NOT NULL CHECK((app_id='academy' AND role IN ('student','editor')) OR (app_id='business' AND role='member')),
 status TEXT NOT NULL CHECK(status IN ('active','revoked')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL REFERENCES members(id),
 PRIMARY KEY(app_id,member_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_pair_codes (
 code_hash TEXT PRIMARY KEY NOT NULL,
 app_id TEXT NOT NULL CHECK(app_id IN ('academy','business')),
 member_id TEXT NOT NULL REFERENCES members(id),
 origin TEXT NOT NULL,
 challenge TEXT NOT NULL,
 credential_version INTEGER NOT NULL,
 access_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 used_at INTEGER,
 redemption_hash TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_pair_member ON app_pair_codes(member_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_pair_expiry ON app_pair_codes(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_access_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 app_id TEXT NOT NULL CHECK(app_id IN ('academy','business')),
 member_id TEXT NOT NULL REFERENCES members(id),
 credential_version INTEGER NOT NULL,
 access_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 revoked_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_sessions_member ON app_access_sessions(member_id,app_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_access_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_organizations (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 created_by TEXT NOT NULL REFERENCES members(id),
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_organization_members (
 organization_id TEXT NOT NULL REFERENCES app_organizations(id),
 member_id TEXT NOT NULL REFERENCES members(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','accountant','viewer')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 operation_id TEXT NOT NULL DEFAULT '',
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(organization_id,member_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_organizations_member ON app_organization_members(member_id,organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_drafts (
 app_id TEXT NOT NULL CHECK(app_id IN ('academy','business')),
 scope_id TEXT NOT NULL,
 id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 revision INTEGER NOT NULL CHECK(revision>=1),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL REFERENCES members(id),
 operation_id TEXT NOT NULL,
 deleted_at INTEGER,
 PRIMARY KEY(app_id,scope_id,id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_drafts_scope ON app_drafts(app_id,scope_id,deleted_at,updated_at);
