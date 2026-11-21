ALTER TABLE registration_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','refused'));
ALTER TABLE registration_requests ADD COLUMN decided_at INTEGER;
ALTER TABLE registration_requests ADD COLUMN decided_by TEXT;
CREATE INDEX registration_requests_status ON registration_requests(status,created_at);
