#!/bin/bash
# Setup SSL certificates for Dispara API
# Usage: ./scripts/setup-ssl.sh your-domain.com

set -e

DOMAIN=${1:?"Usage: $0 <domain>"}
CERTS_DIR="$(dirname "$0")/../certs"

echo "Setting up SSL for: $DOMAIN"

# Create certs directory
mkdir -p "$CERTS_DIR"

# Option 1: Let's Encrypt (production)
if command -v certbot &>/dev/null; then
  echo "Using certbot for Let's Encrypt..."
  sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@nowork.com.br
  sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$CERTS_DIR/fullchain.pem"
  sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem "$CERTS_DIR/privkey.pem"
  sudo chmod 644 "$CERTS_DIR"/*.pem
  echo "Let's Encrypt certificates installed!"
  echo "Set up auto-renewal: sudo certbot renew --deploy-hook 'docker compose -f docker-compose.prod.yml restart nginx'"
else
  # Option 2: Self-signed (development/staging)
  echo "certbot not found. Generating self-signed certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERTS_DIR/privkey.pem" \
    -out "$CERTS_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN/O=NoWork/C=BR"
  echo "Self-signed certificate generated (valid for 365 days)"
  echo "For production, install certbot: sudo apt install certbot"
fi

echo ""
echo "Certificates at: $CERTS_DIR"
echo "Restart nginx: docker compose -f docker-compose.prod.yml restart nginx"
