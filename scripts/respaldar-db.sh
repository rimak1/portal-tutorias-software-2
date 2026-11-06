#!/usr/bin/env sh
# Respaldo de la base de datos del despliegue con Docker Compose.
#
# Uso:   scripts/respaldar-db.sh [carpeta-destino]      (por defecto ./respaldos)
# Genera un archivo comprimido con la fecha y conserva los ultimos 14 respaldos.
# Para programarlo cada dia, agregar a cron:   0 2 * * *  cd /ruta/al/proyecto && scripts/respaldar-db.sh
set -eu

DESTINO="${1:-respaldos}"
CONSERVAR=14
ARCHIVO="$DESTINO/portal-$(date +%Y%m%d-%H%M%S).sql.gz"

mkdir -p "$DESTINO"
# -T: sin terminal, para que funcione desde cron. Se escribe a un temporal y se renombra
# al terminar, de modo que un respaldo a medias nunca quede con el nombre definitivo.
docker compose exec -T db pg_dump -U portal --no-owner portal_tutorias | gzip > "$ARCHIVO.parcial"
mv "$ARCHIVO.parcial" "$ARCHIVO"

# Descarta los mas antiguos.
ls -1t "$DESTINO"/portal-*.sql.gz 2>/dev/null | tail -n +$((CONSERVAR + 1)) | while read -r viejo; do rm -f "$viejo"; done

echo "Respaldo creado: $ARCHIVO"
