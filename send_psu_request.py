#!/usr/bin/env python3
"""
A script to perform a Prescription Status Update (PSU) request.
Loads environment variables from a .env file:
  - PRIVATE_KEY (PEM contents) or PRIVATE_KEY_PATH (path to PEM file)
  - API_KEY (APIM application API key)
  - HOST (e.g. internal-dev.api.service.nhs.uk)
  - KID (key ID from APIM portal)
"""


import json
from dotenv import load_dotenv

from utils.psu_requests import (
    obtain_access_token,
    send_psu
)
from utils.utils import load_bundle, load_private_key, get_env

def main():
    load_dotenv()
    private_key = load_private_key()
    api_key = get_env('API_KEY')
    host = get_env('HOST')
    kid = get_env('KID')

    import argparse
    parser = argparse.ArgumentParser(description='Send a Prescription Status Update bundle')
    parser.add_argument('-i', '--input', help='Path to JSON bundle file (defaults to STDIN)')
    args = parser.parse_args()

    bundle = load_bundle(args.input)

    token = obtain_access_token(host, api_key, kid, private_key)
    resp, rid, cid = send_psu(host, token, bundle)

    print(f"Request ID: {rid}")
    print(f"Correlation ID: {cid}")
    print(f"Response: {resp.status_code} {resp.reason}")
    try:
        print(json.dumps(resp.json(), indent=2))
    except ValueError:
        print(resp.text)


if __name__ == '__main__':
    main()
