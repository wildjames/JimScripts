#!/usr/bin/env python3
import os
import argparse
from dotenv import load_dotenv

from utils.pfp_requests import fetch_bundle
from utils.utils import output_bundle, save_bundle


def main():
    load_dotenv()

    host          = os.getenv('HOST')
    client_id     = os.getenv('PFP_API_KEY')
    client_secret = os.getenv('PFP_CLIENT_SECRET')
    redirect_uri  = os.getenv('REDIRECT_URI', 'https://www.google.com/')

    if (not host or not client_id or not client_secret):
        raise EnvironmentError("HOST, PFP_API_KEY and PFP_CLIENT_SECRET must be set in .env")

    parser = argparse.ArgumentParser(
        description="Fetch PfP Bundle for a given NHS number (using OAuth2 auth-code flow)"
    )
    parser.add_argument(
        'nhs_number',
        help="10-digit NHS number to query"
    )
    parser.add_argument(
        '--save-dir',
        type=str,
        metavar='DIR',
        help='Directory to save the generated FHIR Bundle JSON',
        default="./data/psu_requests",
    )
    args = parser.parse_args()

    if args.nhs_number == "5839945242":
        raise ValueError("Do not use this NHS number - it will crash Veit07!")

    bundle = fetch_bundle(
        host,
        client_id,
        client_secret,
        redirect_uri,
        args.nhs_number
    )

    output_bundle(
        bundle,
        False,
        True
    )
    print("\n\n")
    save_bundle(
        "pfp_response",
        bundle,
        args.save_dir,
        nhs_number=args.nhs_number
    )

if __name__ == "__main__":
    main()
