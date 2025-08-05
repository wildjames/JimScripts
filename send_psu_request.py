#!/usr/bin/env python3
"""
A script to perform a Prescription Status Update (PSU) request.
Loads environment variables from a .env file:
  - PRIVATE_KEY (PEM contents) or PRIVATE_KEY_PATH (path to PEM file)
  - API_KEY (APIM application API key)
  - HOST (e.g. internal-dev.api.service.nhs.uk)
  - KID (key ID from APIM portal)
"""


import os
import sys
import time
from typing import Any
import uuid
import json
import requests
import jwt
from dotenv import load_dotenv


def load_private_key():
    key = os.getenv("PRIVATE_KEY")
    path = os.getenv("PRIVATE_KEY_PATH")
    if key:
        return key.replace('\\n', '\n')
    if path and os.path.isfile(path):
        with open(path, 'r') as f:
            return f.read()
    raise ValueError("set PRIVATE_KEY or PRIVATE_KEY_PATH in your .env")


def get_env(var: str):
    val = os.getenv(var)
    if not val:
        raise ValueError(f"{var} not set in .env")
    return val


def load_bundle(input_path: str | None = None) -> Any:
    if input_path:
        with open(input_path, 'r') as f:
            return json.load(f)
    else:
        data = sys.stdin.read()
        return json.loads(data)


def obtain_access_token(host: str, api_key: str, kid: str, private_key: str) -> str:
    auth_url = f"https://{host}/oauth2/token"
    # JWT header & payload
    header = { 'typ': 'JWT', 'alg': 'RS512', 'kid': kid }
    now = int(time.time())
    payload: dict[str, Any] = {
        'sub': api_key,
        'iss': api_key,
        'jti': str(uuid.uuid4()),
        'aud': auth_url,
        'exp': now + 180
    }
    assertion: str = jwt.encode(
        payload,
        private_key,
        algorithm='RS512',
        headers=header
    )
    # Request token
    resp = requests.post(
        auth_url,
        headers={ 'Content-Type': 'application/x-www-form-urlencoded' },
        data={
            'grant_type': 'client_credentials',
            'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion': assertion
        }
    )
    resp.raise_for_status()
    return resp.json().get('access_token')


def send_psu(host: str, token: str, bundle: str):
    url = f"https://{host}/prescription-status-update/"
    # x-request-id & x-correlation-id
    request_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'x-request-id': request_id,
        'x-correlation-id': correlation_id
    }
    resp = requests.post(url, headers=headers, json=bundle)
    return resp, request_id, correlation_id


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
