#!/usr/bin/env python3

import argparse
from utils.data_generators import generate_nhs_numbers, complete_nhs_number

def main():
    parser = argparse.ArgumentParser(
        description="Generate or validate NHS numbers with optional invalid or dummy flags."
    )
    parser.add_argument(
        '-n', '--count', type=int,
        help='Generate a list of NHS numbers of length N'
    )
    parser.add_argument(
        '-c', '--complete', type=str,
        metavar='9_DIGITS',
        help='Generate the full NHS number by computing the check digit for a 9-digit input'
    )
    parser.add_argument(
        '--dummy', action='store_true',
        help="Generate a dummy NHS number (always starts with '999')"
    )
    parser.add_argument(
        '--invalid', action='store_true',
        help='Produce NHS numbers with incorrect check digits'
    )
    args = parser.parse_args()

    if args.complete:
        nine = args.complete

        full = complete_nhs_number(nine, invalid=args.invalid)
        print(full)

    elif args.count is not None:
        nums = generate_nhs_numbers(args.count, invalid=args.invalid, dummy=args.dummy)
        for num in nums:
            print(num)


if __name__ == "__main__":
    main()

