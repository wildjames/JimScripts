#!/usr/bin/env python3

import argparse
import json
import sys
from typing import Any, Dict, List, Optional

from utils.psu_requests import (
    BUSINESS_STATUS_CHOICES,
    canonical_business_status,
    build_bundle,
    output_bundle
)
from utils.pfp_requests import load_collection_entries
from utils.utils import iso_now, find_default_ods


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
        print("No MedicationRequest entries found.", file=sys.stderr)
        sys.exit(1)

    print("Medications in fetched bundle:")
    for idx, m in enumerate(meds, start=1):
        order_no = m['groupIdentifier']['value']
        item_no = m['identifier'][0]['value']
        med_name = m['medicationCodeableConcept']['coding'][0]['display']
        status = m['status']
        nppt_status = m['extension'][0]['extension'][0]['valueCoding']['code']
        print(f"  {idx}. current status: {status:>12s} | {nppt_status:<30s}\t{med_name} (order {order_no}, item {item_no})")

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

    default_ods = find_default_ods(entries)
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

    output_bundle(bundle, args.clipboard, args.output)


if __name__ == '__main__':
    main()
