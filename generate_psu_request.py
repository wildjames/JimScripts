#!/usr/bin/env python3

import argparse

from utils.psu_requests import BUSINESS_STATUS_CHOICES, build_bundle
from utils.utils import output_bundle


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

    args = parser.parse_args()

    bundle = build_bundle(
        business_status=args.business_status,
        order_number=args.order_number,
        order_item_number=args.order_item_number,
        nhs_number=args.nhs_number,
        ods_code=args.ods_code,
        last_modified=args.last_modified
    )

    output_bundle(bundle, args.clipboard, args.output)


if __name__ == "__main__":
    main()
