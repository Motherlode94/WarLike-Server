-- WarLike Studio: private per-member project records, independent of browser IndexedDB.
CREATE TABLE IF NOT EXISTS studio_projects (
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
CREATE INDEX IF NOT EXISTS studio_projects_owner ON studio_projects(owner_id,updated_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS studio_project_assets (
 id TEXT PRIMARY KEY NOT NULL,
 project_id TEXT NOT NULL REFERENCES studio_projects(id),
 owner_id TEXT NOT NULL REFERENCES members(id),
 object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 byte_length INTEGER NOT NULL CHECK(byte_length>0),
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS studio_project_assets_owner ON studio_project_assets(owner_id,project_id);
