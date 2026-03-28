-- Expliciete bevestigingstijd (naast updated_at); handig voor exports en debugging.
-- Als deze kolom al bestaat (handmatig), sla migratie over of verwijder deze file na handmatige sync.
ALTER TABLE digest_subscribers ADD COLUMN confirmed_at TEXT;
