#!/usr/bin/env python3

import argparse
import uuid
import datetime
import json
import sys
import pyperclip

# Following the spec from here:
# https://digital.nhs.uk/developer/api-catalogue/prescription-status-update-fhir#post-/

# The nine allowed businessStatus codes
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

# Terminal statuses: when reached, no further patient action is required
TERMINAL_STATUSES = {"Collected", "Dispatched", "Not Dispensed"}


def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def canonical_business_status(raw: str) -> str:
    """
    Map a case-insensitive input to one of the canonical BUSINESS_STATUS_CHOICES.
    Raises ValueError if no match.
    """
    raw_lower = raw.strip().lower()
    for choice in BUSINESS_STATUS_CHOICES:
        if choice.lower() == raw_lower:
            return choice
    raise ValueError(f"Invalid business-status '{raw}'. Must be one of: {', '.join(BUSINESS_STATUS_CHOICES)}")


def build_bundle(args):
    # Map to canonical casing
    bs = canonical_business_status(args.business_status)
    # Determine Task.status
    status = "completed" if bs in TERMINAL_STATUSES else "in-progress"

    task_id = str(uuid.uuid4())

    bundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {
                "fullUrl": f"urn:uuid:{task_id}",
                "resource": {
                    "resourceType": "Task",
                    "id": task_id,
                    "basedOn": [
                        {
                            "identifier": {
                                "system": "https://fhir.nhs.uk/Id/prescription-order-number",
                                "value": args.order_number
                            }
                        }
                    ],
                    "status": status,
                    "businessStatus": {
                        "coding": [
                            {
                                "system": "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                                "code": bs
                            }
                        ]
                    },
                    "intent": "order",
                    "focus": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/prescription-order-item-number",
                            "value": args.order_item_number
                        }
                    },
                    "for": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/nhs-number",
                            "value": args.nhs_number
                        }
                    },
                    "lastModified": args.last_modified or iso_now(),
                    "owner": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                            "value": args.ods_code
                        }
                    }
                },
                "request": {
                    "method": "POST",
                    "url": "Task"
                }
            }
        ]
    }
    return bundle


def main():
    parser = argparse.ArgumentParser(
        description="Generate a FHIR Bundle with a Task resource for a prescription status update."
    )
    parser.add_argument(
        "--business-status",
        required=True,
        help="One of: " + "┃".join(BUSINESS_STATUS_CHOICES) + " (case-insensitive)"
    )
    parser.add_argument(
        "--order-number",
        required=True,
        help="Prescription order number (e.g. 9A822C-A83008-13DCAB)"
    )
    parser.add_argument(
        "--order-item-number",
        required=True,
        help="Prescription order item number (UUID)"
    )
    parser.add_argument(
        "--nhs-number",
        required=True,
        help="Patient NHS number (9 digits plus check digit, e.g. 9998481732)"
    )
    parser.add_argument(
        "--ods-code",
        required=True,
        help="ODS organization code (e.g. FA565)"
    )
    parser.add_argument(
        "--last-modified",
        help="Override lastModified timestamp (ISO-8601 UTC, defaults to now)"
    )

    args = parser.parse_args()

    try:
        bundle = build_bundle(args)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(bundle, indent=2))


    pyperclip.copy(json.dumps(bundle, indent=2))
    print("\n\n------------------------------------")
    print("-->> Bundle copied to clipboard <<--")
    print("------------------------------------")



if __name__ == "__main__":
    main()
