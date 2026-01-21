#!/bin/bash

# Set paths
CERT_DIR="/Users/mariaflorenciamusitani/Desktop/CRM Sports/ssl"
CERT_PATH="$CERT_DIR/certs/crm-sports.crt"
KEY_PATH="$CERT_DIR/private/crm-sports.key"

# Create directories
mkdir -p "$CERT_DIR/certs"
mkdir -p "$CERT_DIR/private"

# Generate SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout "$KEY_PATH" \
-out "$CERT_PATH" \
-subj "/C=AR/ST=Buenos Aires/L=Buenos Aires/O=CRM Sports/OU=IT/CN=crmsports.com/emailAddress=admin@crmsports.com"

echo "Certificate generated at: $CERT_PATH"
echo "Private key generated at: $KEY_PATH"