#!/usr/bin/env sh
# Restaura un respaldo creado con respaldar-db.sh. REEMPLAZA todos los datos actuales.
#
# Uso:   scripts/restaurar-db.sh respaldos/portal-AAAAMMDD-HHMMSS.sql.gz
# Detiene la API durante la restauracion para que nadie escriba mientras tanto.
set -eu

[ $# -eq 1 ] || { echo "Uso: $0 <archivo.sql.gz>" >&2; exit 1; }
ARCHIVO="$1"
[ -f "$ARCHIVO" ] || { echo "No existe el archivo: $ARCHIVO" >&2; exit 1; }

printf "Esto borra los datos actuales y restaura %s. Escribe SI para continuar: " "$ARCHIVO"
read -r RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado."; exit 1; }

docker compose stop api
docker compose exec -T db psql -U portal -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS portal_tutorias WITH (FORCE)" -c "CREATE DATABASE portal_tutorias"
gunzip -c "$ARCHIVO" | docker compose exec -T db psql -U portal -d portal_tutorias -v ON_ERROR_STOP=1 -q
docker compose start api
echo "Restauracion terminada."
