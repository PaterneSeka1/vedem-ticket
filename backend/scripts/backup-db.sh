#!/usr/bin/env bash
# Sauvegarde quotidienne de la base vedem_ticket (MongoDB local du serveur OVH).
# Ne sauvegarde que cette base (l'instance est partagée avec d'autres sites).
# Conserve les RETENTION_DAYS dernières archives. Lancé par le crontab de
# l'utilisateur ubuntu — voir DEPLOYMENT.md §1.7.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/vedem_ticket}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

umask 077
mkdir -p "$BACKUP_DIR"
archive="$BACKUP_DIR/vedem_ticket-$(date +%Y%m%d-%H%M%S).archive.gz"

mongodump --quiet --uri="mongodb://127.0.0.1:27017" --db=vedem_ticket \
  --archive="$archive" --gzip

find "$BACKUP_DIR" -name 'vedem_ticket-*.archive.gz' -mtime +"$RETENTION_DAYS" -delete
