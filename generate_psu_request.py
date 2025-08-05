#!/usr/bin/env python3

# Following the spec from here:
# https://digital.nhs.uk/developer/api-catalogue/prescription-status-update-fhir#post-/

import argparse
import json
import sys
import pyperclip

from utils.psu_requests import BUSINESS_STATUS_CHOICES, build_bundle


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
        bundle = build_bundle(
            business_status=args.business_status,
            order_number=args.order_number,
            order_item_number=args.order_item_number,
            nhs_number=args.nhs_number,
            ods_code=args.ods_code,
            last_modified=args.last_modified
        )
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(bundle, indent=2))

    # Copy to clipboard
    pyperclip.copy(json.dumps(bundle, indent=2))
    print("\n\n------------------------------------")
    print("-->> Bundle copied to clipboard <<--")
    print("------------------------------------")



if __name__ == "__main__":
    main()
