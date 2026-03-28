#!/usr/bin/env bash
# D1-export om schema (en optioneel data) te delen voor migratie-advies.
#
# Gebruik (vanaf de map workers/, met Node 20+ en wrangler login):
#   ./scripts/d1-export-voor-migratie.sh <database-naam-zoals-in-dashboard>
#   ./scripts/d1-export-voor-migratie.sh <database-naam> schema
#
# Het <database-naam> is de NAME in Cloudflare → Workers & Pages → D1 (niet de UUID).
# Tweede argument "schema" = alleen CREATE/INDEX, geen rijen (--no-data), handiger om te mailen.
#
# Output: workers/scripts/exports/d1-export-<naam>-<timestamp>.sql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKERS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKERS_DIR"

DB_NAME="${1:-}"
MODE="${2:-full}"

if [[ -z "$DB_NAME" ]]; then
  echo "Gebruik: $0 <d1-database-naam> [schema]"
  echo "Voorbeeld: $0 voorbijdekop-db-oud"
  echo "Alleen schema (geen data): $0 voorbijdekop-db-oud schema"
  exit 1
fi

mkdir -p "$SCRIPT_DIR/exports"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_NAME="${DB_NAME//[^a-zA-Z0-9._-]/_}"
OUT="$SCRIPT_DIR/exports/d1-export-${SAFE_NAME}-${STAMP}.sql"

EXTRA=(--remote --output "$OUT")
if [[ "$MODE" == "schema" ]]; then
  EXTRA+=(--no-data)
  echo "Exporteer alleen schema (geen tabel-inhoud) naar:"
else
  echo "Exporteer schema + data naar:"
fi
echo "$OUT"
echo ""

npx wrangler d1 export "$DB_NAME" "${EXTRA[@]}"

echo ""
echo "Klaar. Stuur dit .sql-bestand (of plak de inhoud) door voor migratie naar de actieve DB."
if [[ "$MODE" != "schema" ]]; then
  echo "Tip: voor alleen kolom/tabellen zonder persoonsgegevens: $0 \"$DB_NAME\" schema"
fi
