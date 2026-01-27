#!/usr/bin/env python3
import argparse

from utils.pfp_requests import fetch_bundle, get_pfp_env
from utils.utils import output_bundle, save_bundle


def main():

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

    host, client_id, client_secret, redirect_uri = get_pfp_env()

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
        "data/pfp_responses/"
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
