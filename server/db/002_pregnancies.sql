-- Pregnant women at risk of iron deficiency: a second registry next to children,
-- scored with its own 6-dimension form (see server/src/pregnancyScoring.js).
-- __SCHEMA__ is replaced with DB_SCHEMA by migrate.js. Idempotent.

CREATE TABLE IF NOT EXISTS __SCHEMA__.pregnancies (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  age_years        SMALLINT,
  house_number     TEXT,
  village_no       INTEGER,
  village_name     TEXT,
  tambon           TEXT,
  amphoe           TEXT,
  province         TEXT,
  latitude         NUMERIC(10, 7),
  longitude        NUMERIC(10, 7),
  husband_name     TEXT,
  phone            TEXT,
  lmp_date         DATE,                 -- first day of last menstrual period
  delivered_on     DATE,                 -- set when the pregnancy has ended
  hct              NUMERIC(4, 1),
  pre_weight_kg    NUMERIC(5, 2),        -- weight before pregnancy (for BMI)
  current_weight_kg NUMERIC(5, 2),
  height_cm        NUMERIC(5, 1),
  weight_gain      TEXT,                 -- ตามเกณฑ์ / น้อยกว่าเกณฑ์ / มากกว่าเกณฑ์
  iron_status      TEXT,                 -- Triferdine compliance
  food_behavior    TEXT,
  social_status    TEXT,
  risk_factors     TEXT[] NOT NULL DEFAULT '{}',
  hct_score        SMALLINT NOT NULL DEFAULT 0,
  nutrition_score  SMALLINT NOT NULL DEFAULT 0,
  iron_score       SMALLINT NOT NULL DEFAULT 0,
  food_score       SMALLINT NOT NULL DEFAULT 0,
  social_score     SMALLINT NOT NULL DEFAULT 0,
  obstetric_score  SMALLINT NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS pregnancies_village_idx ON __SCHEMA__.pregnancies (village_no) WHERE is_active;

-- Medicine logs now belong to either a child or a pregnancy.
ALTER TABLE __SCHEMA__.medicine_logs ALTER COLUMN child_id DROP NOT NULL;
ALTER TABLE __SCHEMA__.medicine_logs
  ADD COLUMN IF NOT EXISTS pregnancy_id TEXT REFERENCES __SCHEMA__.pregnancies(id) ON DELETE CASCADE;
DO $$ BEGIN
  ALTER TABLE __SCHEMA__.medicine_logs ADD CONSTRAINT medicine_logs_one_subject
    CHECK ((child_id IS NULL) <> (pregnancy_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS medicine_logs_pregnancy_idx ON __SCHEMA__.medicine_logs (pregnancy_id, taken_on DESC);
