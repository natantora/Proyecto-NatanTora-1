-- Midrash Natan Tora - PostgreSQL propio en Railway
-- Este archivo reemplaza por completo el esquema y Auth de Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member','rabino','editor','admin','owner')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_label TEXT NOT NULL,
  seat_number INT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('premium','preferente','general')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','reserved','taken')),
  holder_name TEXT,
  holder_email TEXT,
  holder_phone TEXT,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (row_label, seat_number)
);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  media_type TEXT CHECK (media_type IN ('video','audio','text')),
  media_url TEXT,
  rabbi TEXT DEFAULT 'Rab Natan',
  duration_minutes INT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pending_review BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_published ON classes(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_classes_owner ON classes(owner_id);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT DEFAULT 'Midrash Natan Tora',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('rezo','clase')),
  name TEXT NOT NULL,
  description TEXT,
  days TEXT,
  time TEXT,
  icon TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS shabat_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  latitude NUMERIC DEFAULT 19.4326,
  longitude NUMERIC DEFAULT -99.1332,
  timezone TEXT DEFAULT 'America/Mexico_City',
  candle_lighting_minutes_before INT DEFAULT 20,
  havdalah_minutes_after INT DEFAULT 30,
  minhag TEXT DEFAULT 'Halabi',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO shabat_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  payment_method TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  donor_name TEXT,
  donor_email TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS seat_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve','reject')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_user ON approval_tokens(user_id);

INSERT INTO schedules (kind, name, description, days, time, icon, position) VALUES
  ('rezo', 'Shajarit', 'Rezo de la manana', 'Domingo a Viernes', '7:00 AM', '🕐', 1),
  ('rezo', 'Minha', 'Rezo de la tarde', 'Domingo a Jueves', '1:30 PM', '☀️', 2),
  ('rezo', 'Arvit', 'Rezo de la noche', 'Domingo a Jueves', '7:30 PM', '🌙', 3),
  ('clase', 'Halaja Diaria', 'Clase de Shuljan HaMelej con el Rab', 'Domingo a Jueves', '8:00 AM', '📖', 10),
  ('clase', 'Parashat Hashavua', 'Estudio semanal de la porcion de Tora', 'Miercoles', '9:00 PM', '📜', 11)
ON CONFLICT DO NOTHING;
