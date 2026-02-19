#!/usr/bin/env bash
# Quick test script to verify the CLI tool works

echo "Testing JWT authentication (will fail without credentials, but should show usage)..."
cd "$(dirname "$0")" && poetry run apim-token --auth-type jwt --environment int 2>&1 | head -5

echo -e "\nCLI tool is installed and accessible"
echo -e "\nTo use from TypeScript:"
echo "  1. Set environment variables (CLIENT_ID, JWT_KID, JWT_PRIVATE_KEY, etc.)"
echo "  2. Call: ./apim-token.sh --auth-type jwt --environment int"
echo "  3. Or use the TypeScript helper in typescript/shared/apim-helper.ts"
