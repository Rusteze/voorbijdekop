-- Digest: alleen status = 'confirmed' krijgt de dagelijkse mail (zie cron in src/index.ts)
CREATE TABLE IF NOT EXISTS digest_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending',
  topics_json TEXT,
  confirm_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  ip_hash TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_email ON digest_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_digest_status ON digest_subscribers(status);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_entries(created_at);
