-- Bestaande bevestigde abonnees zonder token krijgen alsnog een afmeldlink in de digest-mail.
UPDATE digest_subscribers
SET unsubscribe_token = lower(hex(randomblob(16)))
WHERE unsubscribe_token IS NULL AND status = 'confirmed';
