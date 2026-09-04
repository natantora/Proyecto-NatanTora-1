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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens(expires_at);

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
  thumbnail_url TEXT,
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

ALTER TABLE classes ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Catálogo público de Zury Marcos en TuTorahtv. Esta carga es idempotente:
-- compara el identificador de YouTube para conservar cualquier clase ya creada.
INSERT INTO classes (
  title, category, media_type, media_url, rabbi, duration_minutes, published, published_at
)
SELECT
  imported.title,
  imported.category,
  'video',
  imported.media_url,
  'Zury Marcos',
  imported.duration_minutes,
  TRUE,
  NOW()
FROM (VALUES
  ('Shofetim 2026- ándele mi poli 5786', 'Parashá', 'https://www.youtube.com/watch?v=tCPcXO5h4kU', 7),
  ('Bola de nieve de Mitzvot', 'General', 'https://www.youtube.com/watch?v=w11hkC-mv5Q', 17),
  ('Purim 5786 - solo Hashem y nada mas', 'Parashá', 'https://www.youtube.com/watch?v=t-8HWT6gH3I', 16),
  ('Yitro - la clave es tora 5786', 'Parashá', 'https://www.youtube.com/watch?v=NdHpQlQqfx4', 34),
  ('Encuéntrale el visto bueno', 'General', 'https://www.youtube.com/watch?v=AaWRjQJB4c0', 14),
  ('El Baseball y la vida', 'General', 'https://www.youtube.com/watch?v=zcip3JZeCDs', 21),
  ('Parashat Ki tisa - ¿Se puede ver a H’ a la cara?', 'Parashá', 'https://www.youtube.com/watch?v=dN0kZ-AGfeA', 13),
  ('Shelah leja - cuánto impacta una palabra', 'Parashá', 'https://www.youtube.com/watch?v=jbXUOJdzfaw', 9),
  ('Perashat Teruma - Tetsaveh - No lo veas por el retrovisor', 'Parashá', 'https://www.youtube.com/watch?v=CGEj3bmq_Q8', 11),
  ('Pesaj - el teléfono de las 4 copas', 'Parashá', 'https://www.youtube.com/watch?v=CNDA0XIdhqA', 38),
  ('Ajare mot - kedoshim 5786 Omer y el sentir del otro', 'Parashá', 'https://www.youtube.com/watch?v=RlZCqHvBwoM', 34),
  ('Teruma y el caballo de los 5 millones', 'Parashá', 'https://www.youtube.com/watch?v=G4D0X5NNFCs', 8),
  ('Por lo que vale la pena abrir el mar', 'General', 'https://www.youtube.com/watch?v=Ya6reFG9Nbo', 15),
  ('Parashat Shelah - Miriam - los espías y la tierra de Israel', 'Parashá', 'https://www.youtube.com/watch?v=7QOYMsJUfrA', 39),
  ('Perashá Terumá - Siempre hay algo que darle a Hashem', 'Parashá', 'https://www.youtube.com/watch?v=rdwi5odWC-o', 12),
  ('¿Cómo saber si lo que hacemos está bien?', 'General', 'https://www.youtube.com/watch?v=6gGdrkO2aUo', 14),
  ('Pesaj 2025 - es un chiste??', 'Parashá', 'https://www.youtube.com/watch?v=de_osIcSlPM', 28),
  ('Parashat Pekude - Cuentas claras', 'Parashá', 'https://www.youtube.com/watch?v=zgb4aCg6MdA', 10),
  ('Para que equipo juegas ?', 'General', 'https://www.youtube.com/watch?v=kOKQhVpoNIk', 10),
  ('Los golpes son para bien', 'General', 'https://www.youtube.com/watch?v=bSeL_8Cd5ho', 14),
  ('Parashat Shemot - ¿Un líder tartamudo?', 'Parashá', 'https://www.youtube.com/watch?v=3UFxGfZbMU4', 9),
  ('Pies firmes en el mar', 'General', 'https://www.youtube.com/watch?v=oK-LQbLPeNg', 15),
  ('Behaaloteja - la comparación, el ladrón de la felicidad', 'Parashá', 'https://www.youtube.com/watch?v=EskFwK8gSWA', 34),
  ('Teruma 5786 el gran souvenir', 'Parashá', 'https://www.youtube.com/watch?v=Bmd-KiFzcRE', 34),
  ('Pesaj - el minuto que hizo la diferencia', 'Parashá', 'https://www.youtube.com/watch?v=6cXQmRteNcM', 6),
  ('Parashat Nasó - Nazir pecador o Nazir kadosh', 'Parashá', 'https://www.youtube.com/watch?v=ADyHsBnweRA', 10),
  ('Lo que le podemos entregar a Hashem', 'General', 'https://www.youtube.com/watch?v=zE8kxV4_YVs', 15),
  ('Parashat Koraj 2024', 'Parashá', 'https://www.youtube.com/watch?v=AsJ1ErEsR9Q', 10),
  ('Levántate del polvo', 'General', 'https://www.youtube.com/watch?v=8QWddwbsn18', 15),
  ('Beshalah - de verdad quieres salir de Misraim?', 'General', 'https://www.youtube.com/watch?v=dNDhO9SBQJc', 34),
  ('¿Puede ser divertida la religión?', 'General', 'https://www.youtube.com/watch?v=b2drVbxnBvE', 18),
  ('Matzah!… Ma hu omer!!', 'General', 'https://www.youtube.com/watch?v=fhUEkil4C4c', 8),
  ('Parashat Behar - No te engañes a ti mismo', 'Parashá', 'https://www.youtube.com/watch?v=Am8Jgwxl7L4', 13),
  ('Tetzave - Purim - el que viste de seda …de seda se queda!', 'Parashá', 'https://www.youtube.com/watch?v=amIRZ3UlWfQ', 30),
  ('Teruma - Naase venishma en el mishcan?? En nuestras misvot? 5786', 'Parashá', 'https://www.youtube.com/watch?v=DZph3eqj4uY', 10),
  ('Que no te roben lo bueno', 'General', 'https://www.youtube.com/watch?v=uW5I2kBOXV8', 10),
  ('La verdadera manera de embellecer las Mitzvot', 'General', 'https://www.youtube.com/watch?v=AHQAadLwhqQ', 9),
  ('Parashat Ki tisa - ¿Sabes por qué no eres Cohen?', 'Parashá', 'https://www.youtube.com/watch?v=wlhR6PwPzII', 6),
  ('Parashá Vaishlaj', 'Parashá', 'https://www.youtube.com/watch?v=JgHELqJ_Kkk', 17),
  ('Parashat Beshalaj - La prueba del Man', 'Parashá', 'https://www.youtube.com/watch?v=IuM3qn8T1bc', 8),
  ('Perashat Bo - Lo difícil de la oscuridad', 'Parashá', 'https://www.youtube.com/watch?v=jLi5nufRpgE', 8),
  ('Parashat Mishpatim ...Y estas tambien 5786', 'Parashá', 'https://www.youtube.com/watch?v=PbtMhAXW2Tk', 36),
  ('Libro de Vayikra - ¿Se van a burlar de ti?', 'General', 'https://www.youtube.com/watch?v=7N9RIaISRoM', 9),
  ('¿Nos pesa Elul?', 'General', 'https://www.youtube.com/watch?v=JYhqXx2NHLI', 12),
  ('Parashat Balak - El obstáculo (mensaje) del burro', 'Parashá', 'https://www.youtube.com/watch?v=svIR8kVg3Xw', 9),
  ('Tazria Tahor - 2026 Cambia tu Ayin y no caerás', 'General', 'https://www.youtube.com/watch?v=HTntdsyHLIU', 34),
  ('Perashat Teruma - build a bear hamikdash 5785', 'Parashá', 'https://www.youtube.com/watch?v=HuN0StA7HY0', 25),
  ('Parashat Vayakhel - Para - el calendario adentro del refri 2025', 'Parashá', 'https://www.youtube.com/watch?v=7113hL7gl-A', 39),
  ('Parashat Vaera - Un líder, sufre con su pueblo', 'Parashá', 'https://www.youtube.com/watch?v=QyBKgWFUy98', 9),
  ('¿Bola de home run o cerveza? - Lej Leja', 'General', 'https://www.youtube.com/watch?v=AFWKHjj1IFs', 8),
  ('Purim - Ayuno en la montaña rusa', 'Parashá', 'https://www.youtube.com/watch?v=uTzfdbsHVMI', 12),
  ('Parashat Ki tisa - La mitad de la película', 'Parashá', 'https://www.youtube.com/watch?v=wLcJATMTujM', 10),
  ('Parashat Vayetzé - ¿Cuál es la especialidad del Tzadik?', 'Parashá', 'https://www.youtube.com/watch?v=anISomstg_E', 9),
  ('Perashat tazria - Tahor 5786 La causa de la bajada a mitzraim', 'Parashá', 'https://www.youtube.com/watch?v=NresUrzvqRE', 34),
  ('Parashat Behukotay - Aún en la dificultad, algo vales', 'Parashá', 'https://www.youtube.com/watch?v=LzDJT0XD6OQ', 9),
  ('Parashat Behaalotejá - ¡Increíble que Aharon no cambió!', 'Parashá', 'https://www.youtube.com/watch?v=lw9qHX0LJCs', 10),
  ('No digas yo enriquecí a Abraham - Lej Leja', 'General', 'https://www.youtube.com/watch?v=O9O5X_eF_78', 12),
  ('Parashat Balak - El burro que habló o el que habló es burro', 'Parashá', 'https://www.youtube.com/watch?v=iAmcjQ7hUco', 5),
  ('Parashat Balak - No andes viendo la casa de otros ¿o sí?', 'Parashá', 'https://www.youtube.com/watch?v=ouBeD-n5MV4', 6),
  ('Parashat Teruma - que tienes en tu kodesh hakodashim ?', 'Parashá', 'https://www.youtube.com/watch?v=jOtBMA_-8uY', 9),
  ('Parashat Pekude - Moshe robó?', 'Parashá', 'https://www.youtube.com/watch?v=9L4gGcUkNEI', 10)
) AS imported(title, category, media_url, duration_minutes)
WHERE NOT EXISTS (
  SELECT 1
  FROM classes existing
  WHERE existing.media_url LIKE '%' || split_part(imported.media_url, 'v=', 2) || '%'
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT DEFAULT 'Midrash Natan Tora',
  image_url TEXT,
  seating_mode TEXT NOT NULL DEFAULT 'none',
  seat_plan_type TEXT NOT NULL DEFAULT 'architectural',
  capacity INT,
  seat_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  reservations_open BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS seating_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE events ADD COLUMN IF NOT EXISTS seat_plan_type TEXT NOT NULL DEFAULT 'architectural';
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT;
-- Los eventos existentes ya estaban visibles y reservables. Al agregar estas
-- columnas se conserva su comportamiento; los eventos nuevos usan los defaults
-- de borrador/cerrado definidos inmediatamente después.
ALTER TABLE events ADD COLUMN IF NOT EXISTS seat_price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reservations_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ALTER COLUMN published SET DEFAULT FALSE;
ALTER TABLE events ALTER COLUMN reservations_open SET DEFAULT FALSE;
UPDATE events SET published_at = COALESCE(published_at, created_at) WHERE published = TRUE;

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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_seat_plan_type_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_seat_plan_type_check
      CHECK (seat_plan_type IN ('architectural', 'custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_seat_price_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_seat_price_check
      CHECK (seat_price >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS event_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  row_label TEXT NOT NULL,
  seat_number INT NOT NULL,
  price NUMERIC(10,2),
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
-- Un precio nulo usa el precio general del evento. Un valor, incluso 0,
-- permite crear zonas de precios o cortesías específicas por asiento.
ALTER TABLE event_seats ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
-- Los lugares retirados permanecen únicamente si existe historial asociado;
-- nunca se muestran, cuentan en el cupo ni pueden volver a reservarse.
ALTER TABLE event_seats ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_seats_price_check') THEN
    ALTER TABLE event_seats ADD CONSTRAINT event_seats_price_check
      CHECK (price IS NULL OR (price >= 0 AND price <= 1000000));
  END IF;
END $$;

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

-- Sillas detectadas directamente en el plano arquitectonico original.
-- Se mantienen separadas del editor para que ambos planos sean independientes.
CREATE TABLE IF NOT EXISTS architectural_plan_seats (
  seat_number INT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  label TEXT NOT NULL UNIQUE
);

-- Cada evento conserva una copia de las mesas y paredes que existían cuando
-- se creó. Así, editar el salón para un evento futuro no mueve el contexto
-- visual de eventos que ya tienen reservaciones.
CREATE TABLE IF NOT EXISTS event_venue_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('rect', 'round', 'wall')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_venue_tables_event ON event_venue_tables(event_id, created_at);

-- Congela también los eventos con plano creados antes de esta actualización.
INSERT INTO event_venue_tables (event_id, kind, x, y, width, height, rotation, label)
SELECT e.id, t.kind, t.x, t.y, t.width, t.height, t.rotation, t.label
  FROM events e
 CROSS JOIN venue_layout_tables t
 WHERE e.seating_mode = 'assigned'
   AND NOT EXISTS (
     SELECT 1 FROM event_venue_tables snapshot WHERE snapshot.event_id = e.id
   );

CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seat_id UUID REFERENCES event_seats(id) ON DELETE SET NULL,
  holder_name TEXT NOT NULL,
  holder_email TEXT NOT NULL,
  holder_phone TEXT,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, seat_id)
);
CREATE INDEX IF NOT EXISTS idx_event_reservations_event ON event_reservations(event_id, created_at);
ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Una misma persona puede apartar varios asientos en una sola reservación.
-- La unicidad por asiento se conserva para impedir dobles reservaciones.
ALTER TABLE event_reservations
  DROP CONSTRAINT IF EXISTS event_reservations_event_id_user_id_key;

-- Los eventos originales del diseño eran contenido fijo y por eso no aparecían
-- en Administración. Esta migración los importa una sola vez a la tabla real.
-- El marcador evita que vuelvan a crearse si un administrador los elimina.
CREATE TABLE IF NOT EXISTS app_migrations (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La barra inferior del plano tiene cinco sillas que originalmente solo
-- formaban parte de la imagen. Se agregan a los eventos arquitectónicos ya
-- creados para que sean reservables sin alterar ningún lugar existente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migrations WHERE key = '2026-08-add-lower-bar-seats'
  ) THEN
    INSERT INTO event_seats (event_id, row_label, seat_number, status, x, y, rotation)
    SELECT e.id, seat.label, seat.seat_number, 'available', seat.x, 440.72, 0
      FROM events e
      CROSS JOIN (
        VALUES
          ('M65', 65, 321.08::REAL),
          ('M66', 66, 348.45::REAL),
          ('M67', 67, 375.82::REAL),
          ('M68', 68, 403.59::REAL),
          ('M69', 69, 430.96::REAL)
      ) AS seat(label, seat_number, x)
     WHERE e.seating_mode = 'assigned'
       AND e.seat_plan_type = 'architectural'
    ON CONFLICT (event_id, row_label, seat_number) DO NOTHING;

    UPDATE events e
       SET capacity = (
         SELECT COUNT(*)::INT FROM event_seats seat WHERE seat.event_id = e.id
       )
     WHERE e.seating_mode = 'assigned'
       AND e.seat_plan_type = 'architectural';

    INSERT INTO app_migrations (key) VALUES ('2026-08-add-lower-bar-seats');
  END IF;
END $$;

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
  time_mode TEXT NOT NULL DEFAULT 'fixed',
  offset_minutes INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  icon TEXT,
  position INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, name)
);

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS time_mode TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS offset_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_time_mode_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_time_mode_check
      CHECK (time_mode IN ('fixed', 'before_sunset', 'after_sunset'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_offset_minutes_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_offset_minutes_check
      CHECK (offset_minutes BETWEEN -240 AND 240);
  END IF;
END $$;

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
    CHECK (status IN ('pending','paid','failed','refunded','charged_back')),
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

-- Estados de cuenta privados. Una cuenta puede existir antes de que la
-- persona se registre en la pagina y vincularse despues a uno o varios
-- perfiles (por ejemplo, una cuenta familiar).
CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  external_reference TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_external_reference
  ON billing_accounts(LOWER(external_reference)) WHERE external_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_accounts_email
  ON billing_accounts(LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_account_members (
  account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'titular',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, profile_id),
  UNIQUE (profile_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_account_members_profile
  ON billing_account_members(profile_id);

CREATE TABLE IF NOT EXISTS billing_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  import_id UUID REFERENCES billing_imports(id) ON DELETE SET NULL,
  external_reference TEXT NOT NULL,
  concept TEXT NOT NULL,
  period TEXT,
  original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount > 0),
  outstanding_amount NUMERIC(12,2) NOT NULL CHECK (outstanding_amount >= 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','paid','waived')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('excel','manual','adjustment')),
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, external_reference)
);
CREATE INDEX IF NOT EXISTS idx_billing_charges_account
  ON billing_charges(account_id, status, due_date, created_at);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_account_id UUID REFERENCES billing_accounts(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_applied_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mercadopago_preference_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status_detail TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending','paid','failed','refunded','charged_back'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_session
  ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_invoice
  ON payments(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_subscription
  ON payments(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mercadopago_preference
  ON payments(mercadopago_preference_id) WHERE mercadopago_preference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mercadopago_payment
  ON payments(mercadopago_payment_id) WHERE mercadopago_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_billing_account
  ON payments(billing_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_pending_expiry
  ON payments(expires_at) WHERE status = 'pending' AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_provider_status
  ON payments(provider_status, provider_updated_at DESC)
  WHERE provider_status IS NOT NULL;
UPDATE payments
   SET provider_status = CASE status
     WHEN 'paid' THEN 'approved'
     ELSE status
   END,
       provider_updated_at = COALESCE(provider_updated_at, updated_at, created_at)
 WHERE payment_method = 'mercadopago'
   AND provider_status IS NULL
   AND status <> 'failed';

-- Las reservaciones gratuitas se confirman al instante. Las reservaciones con
-- precio se mantienen temporalmente mientras Stripe procesa el pago y solo se
-- confirman cuando el cobro queda pagado.
ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_reservations_status_check') THEN
    ALTER TABLE event_reservations ADD CONSTRAINT event_reservations_status_check
      CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_event_reservations_payment
  ON event_reservations(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_reservations_active
  ON event_reservations(event_id, status, expires_at);
ALTER TABLE event_reservations DROP CONSTRAINT IF EXISTS event_reservations_event_id_seat_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_reservations_active_seat
  ON event_reservations(event_id, seat_id)
  WHERE seat_id IS NOT NULL AND status IN ('pending', 'confirmed');

-- Limpia intentos históricos antes de iniciar el trabajador automático. Esto
-- evita enviar avisos tardíos por pruebas antiguas al activar esta función.
UPDATE event_seats seat
   SET status = 'available'
  FROM event_reservations reservation
  JOIN payments payment ON payment.id = reservation.payment_id
 WHERE reservation.seat_id = seat.id
   AND reservation.status = 'pending'
   AND payment.status = 'pending'
   AND COALESCE(reservation.expires_at, payment.expires_at) <= NOW();
UPDATE event_reservations reservation
   SET status = 'expired'
  FROM payments payment
 WHERE payment.id = reservation.payment_id
   AND reservation.status = 'pending'
   AND payment.status = 'pending'
   AND COALESCE(reservation.expires_at, payment.expires_at) <= NOW();
UPDATE payments
   SET status = 'failed', updated_at = NOW()
 WHERE status = 'pending'
   AND expires_at IS NOT NULL
   AND expires_at <= NOW();

CREATE TABLE IF NOT EXISTS billing_payment_allocations (
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES billing_charges(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payment_id, charge_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_payment_allocations_charge
  ON billing_payment_allocations(charge_id);

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

CREATE TABLE IF NOT EXISTS member_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('email_link', 'admin_panel')),
  approval_token_id UUID REFERENCES approval_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_status_audit_profile_created
  ON member_status_audit(profile_id, created_at DESC);

-- Alertas operativas visibles para administración. El fingerprint permite
-- agrupar una falla repetida sin llenar el correo ni el panel de duplicados.
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  email_delivery_error TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status_date
  ON system_alerts(status, last_occurred_at DESC);

-- Bitácora financiera inmutable. Conserva quién hizo cada cambio y el estado
-- anterior/nuevo, incluso cuando la cuenta posteriormente sea eliminada.
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  account_id UUID REFERENCES billing_accounts(id) ON DELETE SET NULL,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_audit_created
  ON financial_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_account
  ON financial_audit_log(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS database_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  table_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE database_backups ADD COLUMN IF NOT EXISTS backup_date DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_database_backups_date
  ON database_backups(backup_date);
CREATE INDEX IF NOT EXISTS idx_database_backups_started
  ON database_backups(started_at DESC);

INSERT INTO schedules (kind, name, description, days, time, time_mode, offset_minutes, active, icon, position) VALUES
  ('rezo', 'Shajarit', 'Primer minyán', 'Lunes a Viernes', '07:00', 'fixed', 0, TRUE, '🕐', 1),
  ('rezo', 'Minha', 'Rezo de la tarde', 'Domingo a Jueves', '13:30', 'fixed', 0, TRUE, '☀️', 4),
  ('rezo', 'Arvit', 'Horario calculado diariamente', 'Domingo a Jueves', NULL, 'before_sunset', -15, TRUE, '🌙', 5),
  ('clase', 'Halaja Diaria', 'Clase de Shuljan HaMelej con el Rab', 'Domingo a Jueves', '08:00', 'fixed', 0, TRUE, '📖', 10),
  ('clase', 'Parashat Hashavua', 'Estudio semanal de la porcion de Tora', 'Miercoles', '21:00', 'fixed', 0, TRUE, '📜', 11)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = '2026-08-admin-schedules') THEN
    UPDATE schedules SET days = 'Lunes a Viernes', time = '07:00', time_mode = 'fixed', offset_minutes = 0,
      description = 'Primer minyán', active = TRUE, position = 1, updated_at = NOW()
      WHERE kind = 'rezo' AND name = 'Shajarit';
    UPDATE schedules SET days = 'Domingo a Jueves', time = '13:30', time_mode = 'fixed', offset_minutes = 0,
      active = TRUE, position = 4, updated_at = NOW()
      WHERE kind = 'rezo' AND name = 'Minha';
    UPDATE schedules SET days = 'Domingo a Jueves', time = NULL, time_mode = 'before_sunset', offset_minutes = -15,
      description = 'Horario calculado diariamente', active = TRUE, position = 5, updated_at = NOW()
      WHERE kind = 'rezo' AND name = 'Arvit';
    INSERT INTO schedules (kind, name, description, days, time, position) VALUES
      ('rezo', 'Shajarit · 2.º minyán', 'Segundo minyán', 'Lunes a Viernes', '08:00', 2),
      ('rezo', 'Shajarit · Domingo', 'Minyán de domingo', 'Domingo', '08:00', 0),
      ('rezo', 'Shajarit · Shabat', 'Minyán de Shabat', 'Shabat', '08:30', 3)
    ON CONFLICT (kind, name) DO NOTHING;
    INSERT INTO app_migrations (key) VALUES ('2026-08-admin-schedules');
  END IF;
END $$;
