#!/usr/bin/env python3
"""
CLI tool to get APIM authentication tokens.
Outputs JSON to stdout for consumption by TypeScript or other tools.
"""
import argparse
import json
import sys
from os import environ
from typing import Optional

from pytest_nhsd_apim.identity_service import (
    AuthorizationCodeAuthenticator,
    AuthorizationCodeConfig,
    ClientCredentialsConfig,
    ClientCredentialsAuthenticator,
)


def get_env_var(name: str, required: bool = True) -> Optional[str]:
    """Get environment variable with optional requirement check."""
    value = environ.get(name)
    if required and value is None:
        raise ValueError(f"Required environment variable {name} is not set")
    return value


def get_jwt_token(environment: str, client_id: str, jwt_kid: str, jwt_private_key: str) -> dict:
    """Get token using JWT (Client Credentials flow)."""
    url = f"https://{environment.lower()}.api.service.nhs.uk/oauth2-mock"

    config = ClientCredentialsConfig(
        environment=environment.lower(),
        identity_service_base_url=url,
        client_id=client_id,
        jwt_private_key=jwt_private_key,
        jwt_kid=jwt_kid,
    )

    authenticator = ClientCredentialsAuthenticator(config=config)
    token_response = authenticator.get_token()

    if "access_token" not in token_response:
        raise ValueError("Token response does not contain access_token")

    return token_response


def get_oauth2_token(
    environment: str,
    client_id: str,
    client_secret: str,
    scope: str,
    username: str,
    callback_url: str = "https://google.com"
) -> dict:
    """Get token using OAuth2 (Authorization Code flow)."""
    url = f"https://{environment.lower()}.api.service.nhs.uk/oauth2-mock"

    login_form = {"username": username}

    config = AuthorizationCodeConfig(
        environment=environment.lower(),
        identity_service_base_url=url,
        callback_url=callback_url,
        client_id=client_id,
        client_secret=client_secret,
        scope=scope,
        login_form=login_form,
    )

    authenticator = AuthorizationCodeAuthenticator(config=config)
    token_response = authenticator.get_token()

    if "access_token" not in token_response:
        raise ValueError("Token response does not contain access_token")

    return token_response


def main():
    parser = argparse.ArgumentParser(
        description="Get APIM authentication tokens",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment Variables:
  JWT mode:
    CLIENT_ID           - Client ID for the application
    JWT_KID             - Key ID for JWT signing
    JWT_PRIVATE_KEY     - Private key for JWT signing

  OAuth2 mode:
    CLIENT_ID           - Client ID for the application
    CLIENT_SECRET       - Client secret for the application
    USERNAME            - Username for authentication (optional, default: test-user)
    SCOPE               - OAuth2 scope (optional, default: nhs-cis2)
    CALLBACK_URL        - OAuth2 callback URL (optional, default: https://google.com)

Examples:
  # JWT authentication
  export CLIENT_ID="my-client-id"
  export JWT_KID="my-key-id"
  export JWT_PRIVATE_KEY="$(cat private_key.pem)"
  python get_token.py --auth-type jwt --environment int

  # OAuth2 authentication
  export CLIENT_ID="my-client-id"
  export CLIENT_SECRET="my-client-secret"
  export USERNAME="test-user"
  python get_token.py --auth-type oauth2 --environment int
        """
    )

    parser.add_argument(
        "--auth-type",
        choices=["jwt", "oauth2"],
        required=True,
        help="Authentication type: jwt (Client Credentials) or oauth2 (Authorization Code)"
    )

    parser.add_argument(
        "--environment",
        required=True,
        help="Environment (e.g., int, dev, ref, sandbox)"
    )

    parser.add_argument(
        "--output",
        choices=["token", "full"],
        default="token",
        help="Output format: 'token' for just the access token, 'full' for complete response"
    )

    args = parser.parse_args()

    try:
        if args.auth_type == "jwt":
            # JWT authentication requires CLIENT_ID, JWT_KID, JWT_PRIVATE_KEY
            client_id = get_env_var("CLIENT_ID")
            jwt_kid = get_env_var("JWT_KID")
            jwt_private_key = get_env_var("JWT_PRIVATE_KEY")

            token_response = get_jwt_token(
                environment=args.environment,
                client_id=client_id,
                jwt_kid=jwt_kid,
                jwt_private_key=jwt_private_key
            )

        elif args.auth_type == "oauth2":
            # OAuth2 authentication requires CLIENT_ID, CLIENT_SECRET
            client_id = get_env_var("CLIENT_ID")
            client_secret = get_env_var("CLIENT_SECRET")

            # Optional parameters with defaults
            username = get_env_var("USERNAME", required=False) or "test-user"
            scope = get_env_var("SCOPE", required=False) or "nhs-cis2"
            callback_url = get_env_var("CALLBACK_URL", required=False) or "https://google.com"

            token_response = get_oauth2_token(
                environment=args.environment,
                client_id=client_id,
                client_secret=client_secret,
                scope=scope,
                username=username,
                callback_url=callback_url
            )

        # Output to stdout
        if args.output == "token":
            print(token_response["access_token"])
        else:
            print(json.dumps(token_response, indent=2))

        return 0

    except Exception as e:
        error_output = {
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_output), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
