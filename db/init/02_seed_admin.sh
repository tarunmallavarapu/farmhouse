#!/usr/bin/env bash
set -euo pipefail

if [ -z "${ADMIN_PASSWORD_HASH:-}" ]; then
  echo "INFO: ADMIN_PASSWORD_HASH not set; skipping admin seed."
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  INSERT INTO users (email, password_hash, role)
  VALUES ('admin@farm.local', '${ADMIN_PASSWORD_HASH}', 'admin')
  ON CONFLICT (email) DO NOTHING;
EOSQL
echo "Seeded admin user admin@farm.local"
