-- ============================================================
-- BharatPath: Journeys Table Migration
-- Purpose: Persistent storage for user journey lifecycle
-- ============================================================

CREATE TABLE IF NOT EXISTS journeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pnr VARCHAR(10) NOT NULL,
  train_number VARCHAR(10) NOT NULL,
  from_station VARCHAR(10) NOT NULL,
  to_station VARCHAR(10) NOT NULL,
  journey_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one PNR per user (prevents duplicate entries)
ALTER TABLE journeys ADD CONSTRAINT journeys_user_pnr_unique UNIQUE (user_id, pnr);

-- Index for fast lookup by user + status (dashboard hydration)
CREATE INDEX idx_journeys_user_status ON journeys(user_id, status);

-- Index for PNR lookups
CREATE INDEX idx_journeys_pnr ON journeys(pnr);

-- ============================================================
-- Row Level Security (RLS)
-- Users can only access their own journey records
-- ============================================================

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own journeys"
  ON journeys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journeys"
  ON journeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journeys"
  ON journeys FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- Auto-update updated_at timestamp on row modification
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journeys_updated_at
  BEFORE UPDATE ON journeys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
