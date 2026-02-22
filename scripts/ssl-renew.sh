#!/bin/bash
# SSL Certificate Renewal Script
# Add to crontab: 0 0 */60 * * /path/to/ssl-renew.sh

set -e

COMPOSE_FILE="$(dirname "$0")/../docker-compose.prod.yml"

echo "[$(date)] Renewing SSL certificates..."
docker compose -f "$COMPOSE_FILE" run --rm certbot renew --quiet
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
echo "[$(date)] SSL renewal complete."
