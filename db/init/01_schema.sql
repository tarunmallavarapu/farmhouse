-- runs automatically on first DB init
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phone         TEXT 
);

CREATE TABLE IF NOT EXISTS farmhouses (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  size       INTEGER NOT NULL,                                -- required
  location   TEXT NOT NULL,                                   -- required
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmhouses_owner    ON farmhouses(owner_id);
CREATE INDEX IF NOT EXISTS idx_farmhouses_location ON farmhouses(location);
CREATE INDEX IF NOT EXISTS idx_farmhouses_size     ON farmhouses(size);

CREATE TABLE IF NOT EXISTS day_status (
  id            SERIAL PRIMARY KEY,
  farmhouse_id  INTEGER NOT NULL REFERENCES farmhouses(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  is_booked     BOOLEAN NOT NULL DEFAULT FALSE,
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(farmhouse_id, day)
);
CREATE INDEX IF NOT EXISTS idx_day_status_farmhouse_day ON day_status(farmhouse_id, day);
