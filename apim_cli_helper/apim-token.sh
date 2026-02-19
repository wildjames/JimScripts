#!/usr/bin/env bash
# Wrapper script to invoke apim-token from Poetry environment
# This allows TypeScript packages to call it without knowing the Poetry details

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" && poetry run apim-token "$@"
