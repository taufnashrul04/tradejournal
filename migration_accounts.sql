-- ============================================
-- MIGRATION: Tambah fitur multi-akun
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tabel accounts
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'personal' CHECK (type IN ('prop', 'personal', 'demo')),
  description TEXT,
  color TEXT DEFAULT '#7c6ff7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts'
    AND policyname = 'User can manage own accounts'
  ) THEN
    CREATE POLICY "User can manage own accounts" ON accounts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tambah kolom account_id ke trades (nullable, trade lama tetap jalan)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;
