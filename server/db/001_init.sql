-- IRON RISK application schema. Kept out of "public" so the Supabase REST API
-- (anon key) cannot reach it; only the backend connects, via DATABASE_URL.
-- __SCHEMA__ is replaced with DB_SCHEMA by migrate.js. Idempotent: safe to run again.

CREATE SCHEMA IF NOT EXISTS __SCHEMA__;
REVOKE ALL ON SCHEMA __SCHEMA__ FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS __SCHEMA__.users (
  id              BIGSERIAL PRIMARY KEY,
  provider_id     TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  position        TEXT,
  hospital        TEXT,
  hcode           TEXT,
  role            TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'vhv')),
  assigned_village_no INTEGER,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Suspended')),
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.children (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  age              TEXT,
  house_number     TEXT,
  village_no       INTEGER,
  village_name     TEXT,
  tambon           TEXT,
  amphoe           TEXT,
  province         TEXT,
  latitude         NUMERIC(10, 7),
  longitude        NUMERIC(10, 7),
  hct              NUMERIC(4, 1),
  weight_kg        NUMERIC(5, 2),
  height_cm        NUMERIC(5, 1),
  nutrition_status TEXT,
  iron_status      TEXT,
  food_behavior    TEXT,
  social_status    TEXT,
  caregiver_name   TEXT,
  hct_score        SMALLINT NOT NULL DEFAULT 0,
  nutrition_score  SMALLINT NOT NULL DEFAULT 0,
  iron_score       SMALLINT NOT NULL DEFAULT 0,
  food_score       SMALLINT NOT NULL DEFAULT 0,
  social_score     SMALLINT NOT NULL DEFAULT 0,
  total_score      SMALLINT NOT NULL DEFAULT 0,
  risk_level       TEXT NOT NULL DEFAULT 'เสี่ยงต่ำ',
  last_medication_at TIMESTAMPTZ,
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by       BIGINT REFERENCES __SCHEMA__.users(id),
  updated_by       BIGINT REFERENCES __SCHEMA__.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS children_village_idx ON __SCHEMA__.children (village_name) WHERE is_active;

CREATE TABLE IF NOT EXISTS __SCHEMA__.medicine_logs (
  id           BIGSERIAL PRIMARY KEY,
  child_id     TEXT NOT NULL REFERENCES __SCHEMA__.children(id) ON DELETE CASCADE,
  taken_on     DATE NOT NULL,
  taken_time   TIME,
  status       TEXT NOT NULL CHECK (status IN ('กินยาแล้ว', 'ไม่ได้กิน')),
  notes        TEXT,
  recorded_by  BIGINT REFERENCES __SCHEMA__.users(id),
  recorded_by_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medicine_logs_child_idx ON __SCHEMA__.medicine_logs (child_id, taken_on DESC);

CREATE TABLE IF NOT EXISTS __SCHEMA__.activity_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES __SCHEMA__.users(id),
  user_name  TEXT,
  action     TEXT NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON __SCHEMA__.activity_logs (created_at DESC);
