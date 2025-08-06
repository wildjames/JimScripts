#!/usr/bin/env python3
import argparse

from utils.data_generators import generate_nhs_numbers
from utils.create_prescription import create_prescription_message_bundle
from utils.utils import (
    output_bundle,
    save_bundle
)


def main():
    parser = argparse.ArgumentParser(description="Generate a FHIR JSON message for a create prescription order message.")
    parser.add_argument(
        "--nhs-number",
        help="Patient's NHS number (generated if not provided)",
        required=False,
    )
    parser.add_argument(
        "--pharmacy-ods",
        help="Pharmacy ODS organization code (generated if not provided)",
        required=False,
    )
    parser.add_argument(
        "--practitioner-ods",
        help="Practitioner ODS organization code (generated if not provided)",
        required=False,
    )
    parser.add_argument(
        "-n", "--count",
        type=int,
        help="Number of prescriptions to create (defaults to 1)",
        default=1,
    )
    parser.add_argument(
        "--save-dir",
        type=str,
        help="Directory to save the generated FHIR Bundle JSON",
        default="./data/prescriptions",
    )
    args = parser.parse_args()

    if not args.nhs_number:
        nhs_number = generate_nhs_numbers(1, dummy=True)[0]
        print(f"Generated NHS number: {nhs_number}")
    else:
        nhs_number = args.nhs_number

    bundle = create_prescription_message_bundle(
        nhs_number,
        args.count,
        args.pharmacy_ods,
        args.practitioner_ods
    )

    output_bundle(bundle, True, None)
    save_bundle("prescription-bundle", bundle, args.save_dir)

if __name__ == "__main__":
    main()
