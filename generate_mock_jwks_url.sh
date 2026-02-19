#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <JWK JSON file path>"
  exit 1
}

# check args
if [[ $# -ne 1 ]]; then
  usage
fi

# Load the JWK JSON file
JWK_JSON="$1"
if [[ ! -f "$JWK_JSON" ]]; then
  echo "Error: File not found: $JWK_JSON"
  exit 1
fi

# Base64-encode the JSON and print the mock-JWKS URL
ENCODED_JWK=$(openssl base64 -A < "$JWK_JSON")

echo "Mock JWKS URL:"
echo "https://api.service.nhs.uk/mock-jwks/${ENCODED_JWK}"
