-- =====================================================================
-- Midrash Natán Torá — Schema completo para Supabase
-- Pegar este SQL en: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- TABLA: profiles (miembros registrados)
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLA: seats
-- =====================================================================
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  row_label TEXT NOT NULL,
  seat_number INT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('premium','preferente','general')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','taken')),
  holder_name TEXT,
  holder_email TEXT,
  holder_phone TEXT,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (row_label, seat_number)
);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE INDEX IF NOT EXISTS idx_seats_row ON seats(row_label);

-- =====================================================================
-- TABLA: classes
-- =====================================================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  media_type TEXT CHECK (media_type IN ('video','audio','text')),
  media_url TEXT,
  rabbi TEXT DEFAULT 'Rab Natán',
  duration_minutes INT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_published ON classes(published, published_at DESC);

-- =====================================================================
-- TABLA: events
-- =====================================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT DEFAULT 'Midrash Natán Torá',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- =====================================================================
-- TABLA: schedules
-- =====================================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('rezo','clase')),
  name TEXT NOT NULL,
  description TEXT,
  days TEXT,
  time TEXT,
  icon TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLA: shabat_config
-- =====================================================================
CREATE TABLE IF NOT EXISTS shabat_config (
  id INT PRIMARY KEY DEFAULT 1,
  latitude NUMERIC DEFAULT 19.4326,
  longitude NUMERIC DEFAULT -99.1332,
  timezone TEXT DEFAULT 'America/Mexico_City',
  candle_lighting_minutes_before INT DEFAULT 20,
  havdalah_minutes_after INT DEFAULT 30,
  minhag TEXT DEFAULT 'Halabi',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT only_one_row CHECK (id = 1)
);
INSERT INTO shabat_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =====================================================================
-- TABLA: payments
-- =====================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
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
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shabat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seats_public_read" ON seats;
CREATE POLICY "seats_public_read" ON seats FOR SELECT USING (true);

DROP POLICY IF EXISTS "classes_public_read_published" ON classes;
CREATE POLICY "classes_public_read_published" ON classes FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "events_public_read" ON events;
CREATE POLICY "events_public_read" ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "schedules_public_read" ON schedules;
CREATE POLICY "schedules_public_read" ON schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "shabat_public_read" ON shabat_config;
CREATE POLICY "shabat_public_read" ON shabat_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "payments_self_read" ON payments;
CREATE POLICY "payments_self_read" ON payments FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- SEED: asientos — DESHABILITADO (pendiente de definir layout real)
-- =====================================================================
-- El Midrash tiene 3 zonas distintas (Beit Midrash / Sala principal /
-- Expansión) con layout no-uniforme. El seeding se activará cuando se
-- defina el número y ubicación real de cada asiento.
-- Mientras tanto, la página /asientos mostrará "Próximamente".

-- =====================================================================
-- SEED: horarios de rezos y clases
-- =====================================================================
INSERT INTO schedules (kind, name, description, days, time, icon, position) VALUES
  ('rezo', 'Shajarit', 'Rezo de la mañana', 'Domingo a Viernes', '7:00 AM', '🕐', 1),
  ('rezo', 'Minjá', 'Rezo de la tarde', 'Domingo a Jueves', '1:30 PM', '☀️', 2),
  ('rezo', 'Arvit', 'Rezo de la noche', 'Domingo a Jueves', '7:30 PM', '🌙', 3),
  ('clase', 'Halajá Diaria', 'Clase de Shulján HaMélej con el Rab', 'Domingo a Jueves', '8:00 AM', '📖', 10),
  ('clase', 'Parashat Hashavúa', 'Estudio semanal de la porción de Torá', 'Miércoles', '9:00 PM', '📜', 11),
  ('clase', 'Guemará', 'Estudio de Talmud para hombres', 'Domingo', '10:00 AM', '📚', 12),
  ('clase', 'Mussar', 'Ética y desarrollo personal según la Torá', 'Martes', '6:00 PM', '💎', 13)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
SELECT 'seats' AS tabla, COUNT(*) AS total FROM seats
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'classes', COUNT(*) FROM classes
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'schedules', COUNT(*) FROM schedules
UNION ALL SELECT 'payments', COUNT(*) FROM payments;
