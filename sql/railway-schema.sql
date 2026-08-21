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

ALTER TABLE profiles ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider TEXT NOT NULL CHECK (provider IN ('google','apple')),
  provider_account_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_account_id),
  UNIQUE (provider, user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

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
  seating_mode TEXT NOT NULL DEFAULT 'none',
  capacity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS seating_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_seating_mode_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_seating_mode_check
      CHECK (seating_mode IN ('none', 'open', 'assigned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_capacity_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_capacity_check
      CHECK (capacity IS NULL OR capacity > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS event_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  row_label TEXT NOT NULL,
  seat_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, row_label, seat_number)
);
CREATE INDEX IF NOT EXISTS idx_event_seats_event ON event_seats(event_id, row_label, seat_number);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(event_id, status);

-- Posición real del asiento dentro del plano del salón (si el evento usa el
-- mapa real en vez del generador genérico de filas). Nula para eventos viejos.
ALTER TABLE event_seats ADD COLUMN IF NOT EXISTS x REAL;
ALTER TABLE event_seats ADD COLUMN IF NOT EXISTS y REAL;
ALTER TABLE event_seats ADD COLUMN IF NOT EXISTS rotation REAL NOT NULL DEFAULT 0;

-- Plano real y único del salón: mesas y paredes (decorativas, dan contexto
-- visual) y sillas (los lugares reservables). Al crear un evento con
-- reservación "Con plano" se clona el contenido de venue_layout_seats hacia
-- event_seats.
CREATE TABLE IF NOT EXISTS venue_layout_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('rect', 'round', 'wall')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'venue_layout_tables_kind_check') THEN
    ALTER TABLE venue_layout_tables DROP CONSTRAINT venue_layout_tables_kind_check;
  END IF;
  ALTER TABLE venue_layout_tables ADD CONSTRAINT venue_layout_tables_kind_check
    CHECK (kind IN ('rect', 'round', 'wall'));
END $$;

CREATE TABLE IF NOT EXISTS venue_layout_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x REAL NOT NULL,
  y REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE venue_layout_seats ADD COLUMN IF NOT EXISTS rotation REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seat_id UUID REFERENCES event_seats(id) ON DELETE SET NULL,
  holder_name TEXT NOT NULL,
  holder_email TEXT NOT NULL,
  holder_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, seat_id)
);
CREATE INDEX IF NOT EXISTS idx_event_reservations_event ON event_reservations(event_id, created_at);

-- Los eventos originales del diseño eran contenido fijo y por eso no aparecían
-- en Administración. Esta migración los importa una sola vez a la tabla real.
-- El marcador evita que vuelvan a crearse si un administrador los elimina.
CREATE TABLE IF NOT EXISTS app_migrations (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migrations WHERE key = '2026-08-import-static-events'
  ) THEN
    INSERT INTO events (title, description, event_date, location)
    SELECT 'Cena de Lag baOmer', 'Cena comunitaria · Cupo original: 80 personas', '2026-05-22 18:30:00-06', 'Salón principal'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Cena de Lag baOmer'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Shavuot — Tikún Leyl noche entera', 'Estudio toda la noche · Refrigerio incluido', '2026-06-02 22:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Shavuot — Tikún Leyl noche entera'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Rosh haShaná — Selijot y Tefilot', 'Fiesta mayor · Plano de asientos disponible', '2026-09-23 08:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Rosh haShaná — Selijot y Tefilot'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Pésaj — Séder comunitario', 'Registro histórico · El contenido original solo indicaba abril de 2026.', '2026-04-01 12:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Pésaj — Séder comunitario'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Purim — Lectura de la Meguíla', 'Registro histórico · El contenido original solo indicaba marzo de 2026.', '2026-03-01 12:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Purim — Lectura de la Meguíla'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Tu BiShvat — Mesa de frutos', 'Registro histórico · El contenido original solo indicaba enero de 2026.', '2026-01-01 12:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Tu BiShvat — Mesa de frutos'));

    INSERT INTO events (title, description, event_date, location)
    SELECT 'Janucá — Encendido público', 'Registro histórico · El contenido original solo indicaba diciembre de 2025.', '2025-12-01 12:00:00-06', 'Midrash Natán Torá'
    WHERE NOT EXISTS (SELECT 1 FROM events WHERE LOWER(title) = LOWER('Janucá — Encendido público'));

    INSERT INTO app_migrations (key) VALUES ('2026-08-import-static-events');
  END IF;
END $$;

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
