-- ============================================
-- TRADING JOURNAL - Supabase Setup (Safe Run)
-- Bisa dijalankan berulang kali tanpa error
-- ============================================

-- 1. Tabel trades
CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  no INTEGER,
  tanggal DATE NOT NULL,
  hari TEXT,
  entry_model TEXT,
  pair TEXT NOT NULL,
  session TEXT,
  timeframe TEXT,
  posisi TEXT CHECK (posisi IN ('Long', 'Short')),
  hasil TEXT CHECK (hasil IN ('Win', 'Loss', 'BE')),
  pnl NUMERIC(15, 2),
  bukti_url TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- 3. Policy untuk trades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trades'
      AND policyname = 'User can manage own trades'
  ) THEN
    CREATE POLICY "User can manage own trades" ON trades
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Storage bucket untuk upload bukti
INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti', 'bukti', true)
ON CONFLICT DO NOTHING;

-- 5. Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'User can upload bukti'
  ) THEN
    CREATE POLICY "User can upload bukti" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'bukti'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Bukti publicly readable'
  ) THEN
    CREATE POLICY "Bukti publicly readable" ON storage.objects
      FOR SELECT USING (bucket_id = 'bukti');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'User can delete own bukti'
  ) THEN
    CREATE POLICY "User can delete own bukti" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'bukti'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
