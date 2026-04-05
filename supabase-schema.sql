-- Run this in your Supabase SQL Editor
-- https://app.supabase.com → SQL Editor

-- Terms table
CREATE TABLE IF NOT EXISTS terms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  definition  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Connections table
CREATE TABLE IF NOT EXISTS connections (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id   UUID REFERENCES terms(id) ON DELETE CASCADE,
  to_id     UUID REFERENCES terms(id) ON DELETE CASCADE,
  weight    INTEGER DEFAULT 1,
  UNIQUE(from_id, to_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_terms_category   ON terms(category);
CREATE INDEX IF NOT EXISTS idx_terms_name       ON terms(name);
CREATE INDEX IF NOT EXISTS idx_conn_from        ON connections(from_id);
CREATE INDEX IF NOT EXISTS idx_conn_to          ON connections(to_id);

-- Enable Realtime on terms table
ALTER PUBLICATION supabase_realtime ADD TABLE terms;
ALTER PUBLICATION supabase_realtime ADD TABLE connections;

-- Row Level Security (public read, service-role write)
ALTER TABLE terms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read terms"       ON terms       FOR SELECT USING (true);
CREATE POLICY "Public read connections" ON connections FOR SELECT USING (true);

-- Service role can do everything (used by cron + seed script)
CREATE POLICY "Service write terms"       ON terms       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write connections" ON connections FOR ALL USING (auth.role() = 'service_role');
