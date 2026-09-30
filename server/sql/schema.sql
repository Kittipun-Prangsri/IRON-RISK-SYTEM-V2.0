-- Iron Zero Risk — application database (MySQL / MariaDB).
-- Applied by `npm run db:init`

CREATE TABLE IF NOT EXISTS users (
  id                VARCHAR(64)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL DEFAULT '',
  role              VARCHAR(64)  NOT NULL DEFAULT 'รอการอนุมัติ',
  email             VARCHAR(255) NOT NULL DEFAULT '',
  line_user_id      VARCHAR(64)  NOT NULL DEFAULT '',
  phone             VARCHAR(32)  NOT NULL DEFAULT '',
  assigned_village  VARCHAR(255) NOT NULL DEFAULT '',
  status            VARCHAR(16)  NOT NULL DEFAULT 'Pending',
  provider_id       VARCHAR(32)  UNIQUE,
  hosxp_login       VARCHAR(64)  UNIQUE,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_line_user_id ON users (line_user_id);
CREATE INDEX idx_users_email ON users (email);

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
  lat              DOUBLE,
  lng              DOUBLE,
  hct              DECIMAL(5,2),
  weight           DECIMAL(6,2),
  height           DECIMAL(6,2),
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
  status           VARCHAR(32)      NOT NULL DEFAULT 'เสี่ยงต่ำ',
  last_date        VARCHAR(32)      NOT NULL DEFAULT '-',
  notes            TEXT,
  active           SMALLINT         NOT NULL DEFAULT 1,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_children_village ON children (village);
CREATE INDEX idx_children_active ON children (active);

CREATE TABLE IF NOT EXISTS medicine_log (
  log_id      VARCHAR(64) PRIMARY KEY,
  child_id    VARCHAR(64) NOT NULL,
  log_date    VARCHAR(16) NOT NULL DEFAULT '',
  log_time    VARCHAR(8)  NOT NULL DEFAULT '',
  taken       VARCHAR(64) NOT NULL DEFAULT '',
  vhv_id      VARCHAR(64) NOT NULL DEFAULT '',
  notes       TEXT,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_medicine_child ON medicine_log (child_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  ts        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  username  VARCHAR(255) NOT NULL DEFAULT 'system',
  action    VARCHAR(128) NOT NULL DEFAULT '',
  details   TEXT
);
CREATE INDEX idx_activity_ts ON activity_log (ts);

CREATE TABLE IF NOT EXISTS settings (
  k  VARCHAR(64) PRIMARY KEY,
  v  TEXT
);
