#!/usr/bin/env python3

import argparse
import json
import sys
import uuid
from typing import Dict, Any
import pyperclip

from utils.psu_requests import BUSINESS_STATUS_CHOICES, TERMINAL_STATUSES, canonical_business_status
from utils.pfp_requests import load_collection_entries
from utils.utils import iso_now



def prompt_business_status():
    print("Select a new businessStatus:")
    for i, choice in enumerate(BUSINESS_STATUS_CHOICES, start=1):
        print(f"  {i}. {choice}")
    raw = input("Enter number or exact text: ")
    # try numeric index
    if raw.isdigit():
        idx = int(raw)
        if 1 <= idx <= len(BUSINESS_STATUS_CHOICES):
            return BUSINESS_STATUS_CHOICES[idx-1]
    # otherwise treat as text
    return canonical_business_status(raw)


def main():
    parser = argparse.ArgumentParser(
        description="Wizard to build a FHIR Task bundle response based on a PfP fetch result."
    )
    parser.add_argument(
        '-i', '--input',
        help='Path to JSON file containing the PfP response bundle. If omitted, reads STDIN.'
    )
    parser.add_argument(
        "-c", "--clipboard", action="store_true",
        help="Copy the generated bundle to clipboard instead of printing it."
    )
    parser.add_argument(
        "-o", "--output",
        required=False,
        metavar="FILE",
        default=None,
        type=str,
        help="Path to save the generated bundle JSON. If omitted, prints to STDOUT."
    )
    args = parser.parse_args()

    # Load JSON
    if args.input:
        data = json.load(open(args.input))
    else:
        data = input("Paste the PfP response JSON:\n")
        data = json.loads(data)

    entries = load_collection_entries(data)

    # Filter MedicationRequest resources
    meds = [e['resource'] for e in entries if e.get('resource', {}).get('resourceType') == 'MedicationRequest']
    if not meds:
        print("No MedicationRequest entries found.", file=sys.stderr)
        sys.exit(1)

    # List and select
    print("Medications in fetched bundle:")
    for i, m in enumerate(meds, start=1):
        order_no = m['groupIdentifier']['value']
        item_no = m['identifier'][0]['value']
        med = m['medicationCodeableConcept']['coding'][0]['display']
        status = m['status']

        nppt_status = m["extension"][0]["extension"][0]["valueCoding"]["code"]

        print(f"  {i}. current status: {status:>12s} | {nppt_status:<30s}\t{med} (order {order_no}, item {item_no})")
    sel = input(f"Choose an entry to update [1-{len(meds)}]: ")
    try:
        sel_idx = int(sel) - 1
        if sel_idx < 0 or sel_idx >= len(meds): raise ValueError
    except ValueError:
        print("Invalid selection", file=sys.stderr)
        sys.exit(1)

    chosen = meds[sel_idx]
    order_number = chosen['groupIdentifier']['value']
    order_item_number = chosen['identifier'][0]['value']
    nhs_number = chosen['subject']['identifier']['value']

    # Try to guess ODS code from organization resources
    default_ods = None
    for e in entries:
        if e.get('resource', {}).get('resourceType') == 'Organization':
            for ident in e['resource'].get('identifier', []):
                if ident.get('system', '').endswith('/ods-organization-code'):
                    default_ods = ident.get('value')
                    break

    ods_code = input(f"ODS organization code [{default_ods}]: ") or default_ods
    business_status = prompt_business_status()
    lm_raw = input("LastModified timestamp [enter for now]: ")
    last_modified = lm_raw.strip() or iso_now()
    # Build Task
    task_id = str(uuid.uuid4())
    status = 'completed' if business_status in TERMINAL_STATUSES else 'in-progress'

    bundle: Dict[str, Any] = {
        "resourceType": "Bundle",
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {
                "fullUrl": f"urn:uuid:{task_id}",
                "resource": {
                    "resourceType": "Task",
                    "id": task_id,
                    "basedOn": [{
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/prescription-order-number",
                            "value": order_number
                        }
                    }],
                    "status": status,
                    "businessStatus": {"coding": [{
                        "system": "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                        "code": business_status
                    }]},
                    "intent": "order",
                    "focus": {"identifier": {
                        "system": "https://fhir.nhs.uk/Id/prescription-order-item-number",
                        "value": order_item_number
                    }},
                    "for": {"identifier": {
                        "system": "https://fhir.nhs.uk/Id/nhs-number",
                        "value": nhs_number
                    }},
                    "lastModified": last_modified,
                    "owner": {"identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": ods_code
                    }}
                },
                "request": {"method": "POST", "url": "Task"}
            }
        ]
    }

    print(json.dumps(bundle, indent=2))

    if args.clipboard:
        # Copy to clipboard
        pyperclip.copy(json.dumps(bundle, indent=2))
        print("\n\n------------------------------------")
        print("-->> Bundle copied to clipboard <<--")
        print("------------------------------------")

    if args.output:
        # Save to file
        with open(args.output, 'w') as f:
            json.dump(bundle, f, indent=2)
        print(f"Bundle saved to {args.output}")


if __name__ == "__main__":
    main()
