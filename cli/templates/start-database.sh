#!/usr/bin/env bash
# Use this script to start a Docker or Podman container for local PostgreSQL.

# On Windows, run this script from WSL after installing Docker Desktop or Podman Desktop.
# On macOS and Linux, run it directly with ./start-database.sh.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/__ENV_FILE__"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE"
  echo "Create it first with: cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in $ENV_FILE"
  exit 1
fi

if [[ "$DATABASE_URL" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASSWORD="${BASH_REMATCH[3]}"
  DB_HOST="${BASH_REMATCH[4]}"
  DB_PORT="${BASH_REMATCH[5]}"
  DB_NAME="${BASH_REMATCH[6]}"
else
  echo "DATABASE_URL must be a PostgreSQL URL such as postgres://postgres:postgres@localhost:5432/app"
  exit 1
fi

if [[ "$DB_HOST" != "localhost" && "$DB_HOST" != "127.0.0.1" ]]; then
  echo "DATABASE_URL points to '$DB_HOST', not a local database. Update it before running this script."
  exit 1
fi

DB_CONTAINER_NAME="${DB_NAME}-postgres"
if [[ ! "$DB_CONTAINER_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then
  echo "The database name '$DB_NAME' cannot be used as a Docker container name."
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  DOCKER_CMD="docker"
elif command -v podman >/dev/null 2>&1; then
  DOCKER_CMD="podman"
else
  echo "Docker or Podman is not installed. Install one and try again."
  echo "Docker: https://docs.docker.com/engine/install/"
  echo "Podman: https://podman.io/getting-started/installation"
  exit 1
fi

if ! "$DOCKER_CMD" info >/dev/null 2>&1; then
  echo "$DOCKER_CMD is not running. Start it and try again."
  exit 1
fi

CONTAINER_FILTER="name=^/${DB_CONTAINER_NAME}$"

wait_for_database() {
  local attempt

  for ((attempt = 1; attempt <= 30; attempt++)); do
    if "$DOCKER_CMD" exec "$DB_CONTAINER_NAME" pg_isready \
      --username="$DB_USER" \
      --dbname="$DB_NAME" >/dev/null 2>&1; then
      echo "Database container '$DB_CONTAINER_NAME' is ready"
      return 0
    fi
    sleep 1
  done

  echo "Database container '$DB_CONTAINER_NAME' did not become ready in time."
  echo "Check its logs with: $DOCKER_CMD logs $DB_CONTAINER_NAME"
  return 1
}

if [[ -n "$("$DOCKER_CMD" ps -q --filter "$CONTAINER_FILTER")" ]]; then
  echo "Database container '$DB_CONTAINER_NAME' is already running"
  wait_for_database
  exit 0
fi

if [[ -n "$("$DOCKER_CMD" ps -aq --filter "$CONTAINER_FILTER")" ]]; then
  "$DOCKER_CMD" start "$DB_CONTAINER_NAME" >/dev/null
  echo "Existing database container '$DB_CONTAINER_NAME' started"
  wait_for_database
  exit 0
fi

if command -v nc >/dev/null 2>&1 && nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
  echo "Port $DB_PORT is already in use. Change DATABASE_URL or stop the process using it."
  exit 1
fi

"$DOCKER_CMD" run --detach \
  --name "$DB_CONTAINER_NAME" \
  --env "POSTGRES_USER=$DB_USER" \
  --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  --env "POSTGRES_DB=$DB_NAME" \
  --publish "$DB_PORT:5432" \
  docker.io/postgres:18-alpine

echo "Database container '$DB_CONTAINER_NAME' was successfully created"
wait_for_database
