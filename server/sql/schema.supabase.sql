-- READY TO PASTE into Supabase → SQL Editor (schema = iron_risk).
-- Generated from sql/schema.sql; safe to run more than once. Equivalent to: npm run db:init

-- Iron Zero Risk — application database (PostgreSQL / Supabase).
-- Applied by `npm run db:init`, which replaces iron_risk with DB_SCHEMA.
-- Tables live in a dedicated schema, NOT "public": Supabase publishes "public"
-- through its REST API (anon key), and this data is identifiable child health data.
-- Timestamps are Asia/Bangkok wall-clock time (timestamp without time zone).

CREATE SCHEMA IF NOT EXISTS iron_risk;
SET search_path TO iron_risk;

CREATE TABLE IF NOT EXISTS users (
  id                VARCHAR(64)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL DEFAULT '',
  role              VARCHAR(64)  NOT NULL DEFAULT 'รอการอนุมัติ',  -- เจ้าหน้าที่ รพ. | admin | อสม. | รอการอนุมัติ
  email             VARCHAR(255) NOT NULL DEFAULT '',
  line_user_id      VARCHAR(64)  NOT NULL DEFAULT '',
  phone             VARCHAR(32)  NOT NULL DEFAULT '',
  assigned_village  VARCHAR(255) NOT NULL DEFAULT '',
  status            VARCHAR(16)  NOT NULL DEFAULT 'Pending',     -- Active | Pending | Inactive | Disabled
  provider_id       VARCHAR(32)  UNIQUE,                         -- MOPH Provider ID
  hosxp_login       VARCHAR(64)  UNIQUE,                         -- HOSxP opduser.loginname
  created_at        TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok'),
  updated_at        TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')
);
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users (line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS children (
  id               VARCHAR(64)      PRIMARY KEY,
  name             VARCHAR(255)     NOT NULL DEFAULT '',
  age              VARCHAR(32)      NOT NULL DEFAULT '',
  house            VARCHAR(64)      NOT NULL DEFAULT '',
  moo              VARCHAR(16)      NOT NULL DEFAULT '',
  village          VARCHAR(255)     NOT NULL DEFAULT '',
  tambon           VARCHAR(128)     NOT NULL DEFAULT 'คลองหาด',
  amphoe           VARCHAR(128)     NOT NULL DEFAULT 'คลองหาด',
  province         VARCHAR(128)     NOT NULL DEFAULT 'สระแก้ว',
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  hct              NUMERIC(5,2),
  weight           NUMERIC(6,2),
  height           NUMERIC(6,2),
  nutrition        VARCHAR(64)      NOT NULL DEFAULT '',
  iron             VARCHAR(64)      NOT NULL DEFAULT '',
  food             VARCHAR(64)      NOT NULL DEFAULT '',
  social           VARCHAR(64)      NOT NULL DEFAULT '',
  guardian         VARCHAR(255)     NOT NULL DEFAULT '',
  score_hct        SMALLINT         NOT NULL DEFAULT 0,
  score_nutrition  SMALLINT         NOT NULL DEFAULT 0,
  score_iron       SMALLINT         NOT NULL DEFAULT 0,
  score_food       SMALLINT         NOT NULL DEFAULT 0,
  score_social     SMALLINT         NOT NULL DEFAULT 0,
  total_score      SMALLINT         NOT NULL DEFAULT 0,
  status           VARCHAR(32)      NOT NULL DEFAULT 'เสี่ยงต่ำ',     -- เสี่ยงต่ำ | เสี่ยงปานกลาง | เสี่ยงสูง
  last_date        VARCHAR(32)      NOT NULL DEFAULT '-',            -- yyyy-MM-dd or '-' (text, like the sheet)
  notes            TEXT,
  active           SMALLINT         NOT NULL DEFAULT 1,
  created_at       TIMESTAMP        NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok'),
  updated_at       TIMESTAMP        NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')
);
CREATE INDEX IF NOT EXISTS idx_children_village ON children (village);
CREATE INDEX IF NOT EXISTS idx_children_active ON children (active);

CREATE TABLE IF NOT EXISTS medicine_log (
  log_id      VARCHAR(64) PRIMARY KEY,
  child_id    VARCHAR(64) NOT NULL,
  log_date    VARCHAR(16) NOT NULL DEFAULT '',   -- yyyy-MM-dd
  log_time    VARCHAR(8)  NOT NULL DEFAULT '',   -- HH:mm
  taken       VARCHAR(64) NOT NULL DEFAULT '',
  vhv_id      VARCHAR(64) NOT NULL DEFAULT '',
  notes       TEXT,
  created_at  TIMESTAMP   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')
);
CREATE INDEX IF NOT EXISTS idx_medicine_child ON medicine_log (child_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts        TIMESTAMP    NOT NULL,
  username  VARCHAR(255) NOT NULL DEFAULT 'system',
  action    VARCHAR(128) NOT NULL DEFAULT '',
  details   TEXT
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log (ts);

-- Non-secret settings editable from the Settings page (secrets live in .env only).
CREATE TABLE IF NOT EXISTS settings (
  k  VARCHAR(64) PRIMARY KEY,
  v  TEXT
);

-- updated_at maintenance (MySQL's ON UPDATE CURRENT_TIMESTAMP equivalent).
CREATE OR REPLACE FUNCTION iron_risk.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now() AT TIME ZONE 'Asia/Bangkok';
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION iron_risk.set_updated_at();
DROP TRIGGER IF EXISTS trg_children_updated_at ON children;
CREATE TRIGGER trg_children_updated_at BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION iron_risk.set_updated_at();

-- Defence in depth on Supabase: row-level security with no policies, so the
-- anon / authenticated API roles can read nothing even if this schema is ever
-- exposed. The server connects as the table owner, which RLS does not restrict.
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE children     ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA iron_risk FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA iron_risk FROM anon, authenticated';
  END IF;
END
$$;
