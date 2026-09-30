-- Iron Zero Risk — application database (MySQL 8 / MariaDB 10.5+).
-- Keep this in its OWN database (e.g. `iron_risk`), never inside the HOSxP
-- database: HOSxP upgrades may drop or alter unknown tables.
-- Columns mirror the former Google Sheets ("ข้อมูลเด็ก", "Users",
-- "MedicineLog", "ActivityLog") so data migrates 1:1.

CREATE TABLE IF NOT EXISTS users (
  id                VARCHAR(64)  NOT NULL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL DEFAULT '',
  role              VARCHAR(64)  NOT NULL DEFAULT 'รอการอนุมัติ',  -- เจ้าหน้าที่ รพ. | admin | อสม. | รอการอนุมัติ
  email             VARCHAR(255) NOT NULL DEFAULT '',
  line_user_id      VARCHAR(64)  NOT NULL DEFAULT '',
  phone             VARCHAR(32)  NOT NULL DEFAULT '',
  assigned_village  VARCHAR(255) NOT NULL DEFAULT '',
  status            VARCHAR(16)  NOT NULL DEFAULT 'Pending',     -- Active | Pending | Inactive | Disabled
  provider_id       VARCHAR(32)  NULL,                           -- MOPH Provider ID (13 chars)
  hosxp_login       VARCHAR(64)  NULL,                           -- HOSxP opduser.loginname
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_provider_id (provider_id),
  UNIQUE KEY uq_users_hosxp_login (hosxp_login),
  KEY idx_users_line_user_id (line_user_id),
  KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS children (
  id               VARCHAR(64)   NOT NULL PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL DEFAULT '',
  age              VARCHAR(32)   NOT NULL DEFAULT '',
  house            VARCHAR(64)   NOT NULL DEFAULT '',
  moo              VARCHAR(16)   NOT NULL DEFAULT '',
  village          VARCHAR(255)  NOT NULL DEFAULT '',
  tambon           VARCHAR(128)  NOT NULL DEFAULT 'คลองหาด',
  amphoe           VARCHAR(128)  NOT NULL DEFAULT 'คลองหาด',
  province         VARCHAR(128)  NOT NULL DEFAULT 'สระแก้ว',
  lat              DOUBLE        NULL,
  lng              DOUBLE        NULL,
  hct              DECIMAL(5,2)  NULL,
  weight           DECIMAL(6,2)  NULL,
  height           DECIMAL(6,2)  NULL,
  nutrition        VARCHAR(64)   NOT NULL DEFAULT '',
  iron             VARCHAR(64)   NOT NULL DEFAULT '',
  food             VARCHAR(64)   NOT NULL DEFAULT '',
  social           VARCHAR(64)   NOT NULL DEFAULT '',
  guardian         VARCHAR(255)  NOT NULL DEFAULT '',
  score_hct        TINYINT       NOT NULL DEFAULT 0,
  score_nutrition  TINYINT       NOT NULL DEFAULT 0,
  score_iron       TINYINT       NOT NULL DEFAULT 0,
  score_food       TINYINT       NOT NULL DEFAULT 0,
  score_social     TINYINT       NOT NULL DEFAULT 0,
  total_score      TINYINT       NOT NULL DEFAULT 0,
  status           VARCHAR(32)   NOT NULL DEFAULT 'เสี่ยงต่ำ',     -- เสี่ยงต่ำ | เสี่ยงปานกลาง | เสี่ยงสูง
  last_date        VARCHAR(32)   NOT NULL DEFAULT '-',            -- yyyy-MM-dd, or '-' (kept as text like the sheet)
  notes            TEXT          NULL,
  active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_children_village (village),
  KEY idx_children_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_log (
  log_id      VARCHAR(64)  NOT NULL PRIMARY KEY,
  child_id    VARCHAR(64)  NOT NULL,
  log_date    VARCHAR(16)  NOT NULL DEFAULT '',   -- yyyy-MM-dd
  log_time    VARCHAR(8)   NOT NULL DEFAULT '',   -- HH:mm
  taken       VARCHAR(64)  NOT NULL DEFAULT '',
  vhv_id      VARCHAR(64)  NOT NULL DEFAULT '',
  notes       TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_medicine_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ts        DATETIME     NOT NULL,                -- Asia/Bangkok local time
  user      VARCHAR(255) NOT NULL DEFAULT 'system',
  action    VARCHAR(128) NOT NULL DEFAULT '',
  details   TEXT         NULL,
  KEY idx_activity_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Non-secret settings editable from the Settings page (secrets live in .env only).
CREATE TABLE IF NOT EXISTS settings (
  k  VARCHAR(64) NOT NULL PRIMARY KEY,
  v  TEXT        NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
