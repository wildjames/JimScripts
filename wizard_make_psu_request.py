#!/usr/bin/env python3

import argparse
import json
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from utils.psu_requests import (
    BUSINESS_STATUS_CHOICES,
    canonical_business_status,
    build_bundle,
    obtain_access_token,
    send_psu
)
from utils.pfp_requests import load_collection_entries
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
        '-i', '--input',
        help='Path to JSON file with PfP response bundle; reads STDIN if omitted.'
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


def load_input(path: Optional[str]) -> Dict[str, Any]:
    if path:
        with open(path, 'r') as f:
            return json.load(f)
    raw = input("Paste PfP response JSON:\n")
    return json.loads(raw)

def select_medication(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    meds = [e['resource'] for e in entries if e.get('resource', {}).get('resourceType') == 'MedicationRequest']
    if not meds:
        raise ValueError("No MedicationRequest entries found.")

    print("Medications in fetched bundle:")
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

        print(f"  {idx:>2d}. current status: {status:>12s} | {nppt_status:<30s}\t{order_no}\t{item_no}\t{med_name})")

    choice = input(f"Choose an entry to update [1-{len(meds)}]: ")
    try:
        sel = int(choice)
        return meds[sel - 1]
    except (ValueError, IndexError):
        # value error if not a number, index error if out of range
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
    data = load_input(args.input)
    entries = load_collection_entries(data)

    chosen = select_medication(entries)
    order_num = chosen['groupIdentifier']['value']
    item_num = chosen['identifier'][0]['value']
    nhs_num = chosen['subject']['identifier']['value']

    default_ods = find_dispense_performer_ods(entries, chosen)
    ods = input(f"ODS organization code [{default_ods}]: ") or default_ods
    business_status = prompt_business_status()
    lm = input("LastModified timestamp [enter for now]: ") or iso_now()

    bundle = build_bundle(
        business_status=business_status,
        order_number=order_num,
        order_item_number=item_num,
        nhs_number=nhs_num,
        ods_code=ods,
        last_modified=lm
    )

    save_bundle("psu-request", bundle, args.save_dir)

    if args.send:
        load_dotenv()
        host = get_env('HOST')
        api_key = get_env('API_KEY')
        kid = get_env('KID')
        private_key = load_private_key()

        print(f"Sending bundle to {host}...")

        token = obtain_access_token(host, api_key, kid, private_key)
        resp, rid, cid = send_psu(host, token, bundle)

        print(f"Request ID: {rid}")
        print(f"Correlation ID: {cid}")
        print(f"Response: {resp.status_code} {resp.reason}")
        if resp.status_code != 201:
            raise RuntimeError(f"Failed to send bundle: {resp.text}")
    else:
        output_bundle(bundle, args.clipboard, args.output)


if __name__ == '__main__':
    main()
