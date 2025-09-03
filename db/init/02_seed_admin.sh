#!/usr/bin/env bash
set -euo pipefail

# This script seeds an admin user on FIRST DB INIT.
# Provide a bcrypt hash via ADMIN_PASSWORD_HASH env var.
# Example to generate one: docker compose run --rm api python -c "from passlib.hash import bcrypt; print(bcrypt.hash('Admin@123'))"

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
