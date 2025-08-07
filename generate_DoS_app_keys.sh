#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <KID> [output-directory]"
  exit 1
}

# check args
if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
fi

KID="$1"
OUTDIR="${2:-./data/keys}/${KID}"

# create output dir if needed
mkdir -p "$OUTDIR"

# paths
KEY_PRIVATE="$OUTDIR/${KID}.pem"
KEY_PUBLIC="$OUTDIR/${KID}.pem.pub"
JWK_JSON="$OUTDIR/${KID}.json"

openssl genrsa -out "$KEY_PRIVATE" 4096
openssl rsa -in "$KEY_PRIVATE" -pubout -outform PEM -out "$KEY_PUBLIC"

MODULUS=$(
  openssl rsa -pubin -in "$KEY_PUBLIC" -noout -modulus \
    | cut -d '=' -f2 \
    | xxd -r -p \
    | openssl base64 -A \
    | sed 's|+|-|g; s|/|_|g; s|=||g'
)

cat > "$JWK_JSON" <<EOF
{
  "keys": [
    {
      "kty": "RSA",
      "n": "${MODULUS}",
      "e": "AQAB",
      "alg": "RS512",
      "kid": "${KID}",
      "use": "sig"
    }
  ]
}
EOF

# Base64-encode the JSON and print the mock-JWKS URL
ENCODED_JWK=$(openssl base64 -A < "$JWK_JSON")

echo "✔ Generated:"
echo "  • Private key: $KEY_PRIVATE"
echo "  • Public key:  $KEY_PUBLIC"
echo "  • JWK JSON:    $JWK_JSON"
echo
echo "Mock JWKS URL:"
echo "https://api.service.nhs.uk/mock-jwks/${ENCODED_JWK}"
