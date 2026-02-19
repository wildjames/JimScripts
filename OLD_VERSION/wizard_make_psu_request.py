#!/usr/bin/env python3

import argparse
import json
from pprint import pprint
from typing import Any, Dict

from dotenv import load_dotenv

from utils.data_generators import generate_psu_request_bundle, generate_psu_request_multi_prescription_bundle, validate_nhs_number
from utils.psu_requests import (
    BUSINESS_STATUS_CHOICES,
    canonical_business_status,
    build_psu_bundle,
    build_psu_entry,
    obtain_access_token,
    send_psu
)
from utils.pfp_requests import load_collection_entries, get_pfp_env, fetch_bundle
from utils.utils import (
    get_env,
    iso_now,
    find_dispense_performer_ods,
    load_private_key,
    output_bundle,
    save_bundle
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wizard to build a FHIR Task bundle based on a PfP response."
    )
    parser.add_argument(
        '-w', '--wizard',
        action='store_true',
        help='Run the interactive wizard to create a PSU request bundle, without fetched data.'
    )
    parser.add_argument(
        '-i', '--input',
        help='Path to JSON file with PfP response bundle.'
    )
    parser.add_argument(
        '-n', '--nhs-number',
        help='NHS number to use; if provided, the script will fetch the PfP bundle itself.'
    )
    parser.add_argument(
        '--ods-code',
        help='ODS organization code to use in the PSU request if using wizard mode.'
    )
    parser.add_argument(
        '--business-status',
        help='Business status to set in the PSU request if using wizard mode. Default: "With Pharmacy".',
        default="With Pharmacy"
    )
    parser.add_argument(
        '-c', '--clipboard',
        action='store_true',
        help='Copy the generated bundle to clipboard instead of printing.'
    )
    parser.add_argument(
        '-o', '--output',
        metavar='FILE',
        help='File path to save the bundle; prints to STDOUT if omitted.'
    )
    parser.add_argument(
        '-s', '--send',
        action='store_true',
        help='Send the bundle to the PSU endpoint'
    )
    parser.add_argument(
        '--save-dir',
        type=str,
        metavar='DIR',
        help='Directory to save the generated FHIR Bundle JSON',
        default="./data/psu_requests",
    )
    return parser.parse_args()


def select_medication(body: Dict[str, Any]) -> Dict[str, Any]:
    # Since this takes the user input, I'm keeping it here rather than utils.
    entries = load_collection_entries(body)

    meds = [e['resource'] for e in entries if e.get('resource', {}).get('resourceType') == 'MedicationRequest']
    if not meds:
        raise ValueError("No MedicationRequest entries found.")

    print("Medications in fetched bundle:")
    print("   #        Status | NPPTS Status                               | Order Number          | Item Number                           | Medication")
    for idx, m in enumerate(meds, start=1):
        order_no = m['groupIdentifier']['value']
        item_no = m['identifier'][0]['value']
        med_name = m['medicationCodeableConcept']['coding'][0]['display']
        status = m['status']

        nppt_status_ext = m['extension'][0]['extension']
        nppt_status = "unknown"
        for ext in nppt_status_ext:
            if ext["url"].lower() == "status":
                nppt_status = ext["valueCoding"]["code"]

        print(f"  {idx:>2d}. {status:>12s} | {nppt_status:<40s}\t| {order_no}\t| {item_no}\t| {med_name})")

    choice = input(f"Choose an entry to update [1-{len(meds)}]: ")
    try:
        sel = int(choice)
        return meds[sel - 1]
    except (ValueError, IndexError):
        # User gave bad input
        raise IndexError("Invalid selection")


def prompt_business_status() -> str:
    print("Select a new businessStatus:")
    for i, choice in enumerate(BUSINESS_STATUS_CHOICES, start=1):
        print(f"  {i}. {choice}")
    raw = input("Enter number or exact text: ")
    if raw.isdigit():
        idx = int(raw)
        if 1 <= idx <= len(BUSINESS_STATUS_CHOICES):
            return BUSINESS_STATUS_CHOICES[idx - 1]
    return canonical_business_status(raw)


def main():
    args = parse_args()

    bundle = None
    data: Dict[str, Any] = {}

    if args.input:
        with open(args.input, 'r') as f:
            data = json.load(f)

    elif args.wizard:
        count = int(input("How many prescriptions to create? "))
        if count > 1:
            bundle = generate_psu_request_multi_prescription_bundle(
                business_status=args.business_status,
                count=count,
                ods_code=args.ods_code,
            )

        else:
            # This is the interactive mode where we generate fake data
            nhs_number = args.nhs_number or input("Enter NHS number to use in the request: ")

            if not nhs_number or not validate_nhs_number(nhs_number):
                raise ValueError("NHS number is required (and must be valid) in wizard mode.")

            bundle = generate_psu_request_bundle(
                business_status=args.business_status,
                ods_code=args.ods_code,
                nhs_number=nhs_number,
            )

    elif args.nhs_number:
        # If the nhs number is provided and we're NOT building fake data,
        # we need to fetch the PfP bundle ourselves.
        host, client_id, client_secret, redirect_uri = get_pfp_env()
        data = fetch_bundle(
            host,
            client_id,
            client_secret,
            redirect_uri,
            args.nhs_number
        )

    else:
        raise ValueError("Either --input or --nhs-number must be provided.")

    if not bundle:
        entries: list[dict[str, Any]] = []

        while True:
            try:
                chosen = select_medication(data)
            except IndexError:
                break

            order_num = chosen['groupIdentifier']['value']
            item_num = chosen['identifier'][0]['value']
            nhs_num = chosen['subject']['identifier']['value']

            default_ods = find_dispense_performer_ods(data, chosen)
            ods = input(f"ODS organization code [{default_ods}]: ") or default_ods
            business_status = prompt_business_status()
            lm = input("LastModified timestamp [enter for now]: ") or iso_now()

            entry = build_psu_entry(
                business_status=business_status,
                order_number=order_num,
                order_item_number=item_num,
                nhs_number=nhs_num,
                ods_code=ods,
                last_modified=lm
            )
            entries.append(entry)

        bundle = build_psu_bundle(entries)

    save_bundle("psu-request", bundle, args.save_dir)

    if args.send:
        load_dotenv()
        host = get_env('HOST')
        api_key = get_env('API_KEY')
        kid = get_env('KID')
        private_key = load_private_key()
        is_pr = get_env("IS_PR").strip().lower() == "true"

        token = ""
        if not is_pr:
            print("Getting access token...")
            token = obtain_access_token(host, api_key, kid, private_key)

        print("Sending PSU bundle...")
        resp, rid, cid = send_psu(host, token, bundle)

        print(f"Request ID: {rid}")
        print(f"Correlation ID: {cid}")
        print(f"Response: {resp.status_code} {resp.reason}")
        if resp.status_code != 201:
            pprint(json.loads(resp.text), width=120)
            raise RuntimeError("Failed to send bundle")
    else:
        output_bundle(bundle, args.clipboard, args.output)


if __name__ == '__main__':
    main()
