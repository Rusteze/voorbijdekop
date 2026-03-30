-- Crowd learning: associatie-quiz
-- - daily_quiz: cache van quiz-definitie per dag (optioneel in MVP, maar tabel bestaat voor toekomst)
-- - quiz_responses: antwoorden van gebruikers (geaggregeerd per woord)

CREATE TABLE IF NOT EXISTS daily_quiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  questions_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_quiz_date ON daily_quiz(date);

CREATE TABLE IF NOT EXISTS quiz_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  word TEXT NOT NULL,
  answer TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- Rate-spam beperken: max 1 response per ip per woord per dag
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_unique_ip_word_day ON quiz_responses(date, word, ip_hash);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_day_word ON quiz_responses(date, word);

