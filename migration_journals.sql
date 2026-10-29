-- ============================================
-- MIGRATION: Fitur multi-journal
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tabel journals
CREATE TABLE IF NOT EXISTS journals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'custom',
  emoji TEXT DEFAULT '📊',
  description TEXT,
  color TEXT DEFAULT '#7c6ff7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'journals'
    AND policyname = 'User can manage own journals'
  ) THEN
    CREATE POLICY "User can manage own journals" ON journals
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tambah kolom journal_id ke trades
ALTER TABLE trades ADD COLUMN IF NOT EXISTS journal_id BIGINT REFERENCES journals(id) ON DELETE CASCADE;
