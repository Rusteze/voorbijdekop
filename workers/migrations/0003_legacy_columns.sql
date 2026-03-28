-- Sluit aan bij oude schema (digest_signups / story_feedback) voor migratie en consistente exports.
-- digest_subscribers
ALTER TABLE digest_subscribers ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
ALTER TABLE digest_subscribers ADD COLUMN topic TEXT;
ALTER TABLE digest_subscribers ADD COLUMN unsubscribed_at TEXT;
ALTER TABLE digest_subscribers ADD COLUMN user_agent TEXT;
ALTER TABLE digest_subscribers ADD COLUMN unsubscribe_token TEXT;

CREATE INDEX IF NOT EXISTS idx_digest_created_at ON digest_subscribers(created_at);
CREATE INDEX IF NOT EXISTS idx_digest_unsubscribe_token ON digest_subscribers(unsubscribe_token);

-- feedback_entries
ALTER TABLE feedback_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
ALTER TABLE feedback_entries ADD COLUMN user_agent TEXT;
