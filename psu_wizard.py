#!/usr/bin/env python3

import argparse
import json
import sys
import uuid
import datetime
from typing import Dict, Any, List
import pyperclip

# Allowed NPPT business status values (canonical casing)
BUSINESS_STATUS_CHOICES = [
    "With Pharmacy",
    "With Pharmacy - Preparing Remainder",
    "Ready to Collect",
    "Ready to Collect - Partial",
    "Collected",
    "Dispatched",
    "Not Dispensed",
    "Ready to Dispatch",
    "Ready to Dispatch - Partial"
]

# Terminal statuses trigger Task.status = "completed"
TERMINAL_STATUSES = {"Collected", "Dispatched", "Not Dispensed"}


def iso_now():
    """Current UTC timestamp in ISO-8601 (seconds precision) with Z."""
    return datetime.datetime.now().replace(microsecond=0).isoformat() + "Z"


def canonical_business_status(raw: str) -> str:
    """
    Case-insensitive match of raw input to one of the canonical choices.
    Raises ValueError on no match.
    """
    rl = raw.strip().lower()
    for choice in BUSINESS_STATUS_CHOICES:
        if choice.lower() == rl:
            return choice
    raise ValueError(f"Invalid business status '{raw}'. Choose from: {', '.join(BUSINESS_STATUS_CHOICES)}")


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


def load_collection_entries(body: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Given the top-level PfP response JSON, return the inner 'collection' entries list.
    """
    try:
        top = body['entry'][0]['resource']
        if top.get('resourceType') == 'Bundle' and top.get('type') == 'collection':
            return top['entry']
    except (KeyError, IndexError, TypeError):
        pass
    print("Error: Unable to locate the inner collection bundle in input." , file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Wizard to build a FHIR Task bundle response based on a PfP fetch result."
    )
    parser.add_argument(
        '-i', '--input',
        help='Path to JSON file containing the PfP response bundle. If omitted, reads STDIN.'
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

    # Copy to clipboard
    pyperclip.copy(json.dumps(bundle, indent=2))
    print("\n\n------------------------------------")
    print("-->> Bundle copied to clipboard <<--")
    print("------------------------------------")



if __name__ == "__main__":
    main()
