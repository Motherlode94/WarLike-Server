-- Explicit short-lived consent codes for cross-origin WarLike Heart account linking.
CREATE TABLE IF NOT EXISTS heart_pair_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS heart_pair_codes_expiry ON heart_pair_codes(expires_at);
