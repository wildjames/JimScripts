#!/usr/bin/env python3

import argparse
import random
import sys

# Following the spec from here:
# https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html

# Multipliers for the first 9 digits
WEIGHTS = list(range(10, 1, -1))  # [10, 9, ..., 2]


def calculate_check_digit(nine_digits: str) -> int:
    """
    Calculate the check digit for the first nine digits of an NHS number.

    Args:
        nine_digits (str): A string of 9 numeric characters.

    Returns:
        int: The check digit (0-9).

    Raises:
        ValueError: If any character in nine_digits is not a digit, or if the computed check digit is invalid (i.e., 10).
    """
    if len(nine_digits) != 9 or not nine_digits.isdigit():
        raise ValueError("Input must be exactly 9 digits.")

    total = sum(int(d) * w for d, w in zip(nine_digits, WEIGHTS))
    remainder = total % 11
    result = 11 - remainder

    if result == 11:
        return 0
    if result == 10:
        raise ValueError("Invalid NHS number sequence (check digit would be 10).")
    return result


def complete_nhs_number(nine_digits: str, invalid: bool = False) -> str:
    """
    Return a complete NHS number by appending the correct or incorrect check digit.
    """
    cd = calculate_check_digit(nine_digits)
    if invalid:
        # Pick a digit (0-9) that isn't the correct one
        choices = [d for d in range(10) if d != cd]
        cd = random.choice(choices)
    return nine_digits + str(cd)


def generate_nhs_numbers(count: int, invalid: bool = False, dummy: bool = False) -> list:
    """
    Generate a list of NHS numbers.

    Args:
        count (int): How many numbers to generate.
        invalid (bool): If True, generate numbers with incorrect check digits.
        dummy (bool): If True, numbers start with '999'.

    Returns:
        list: Generated NHS numbers.
    """
    numbers = []
    while len(numbers) < count:
        if dummy:
            prefix = '999'
            body = ''.join(str(random.randint(0, 9)) for _ in range(6))
            nine = prefix + body
        else:
            nine = ''.join(str(random.randint(0, 9)) for _ in range(9))
        try:
            full = complete_nhs_number(nine, invalid=invalid)
        except ValueError:
            # skip invalid base sequences and retry
            continue
        numbers.append(full)
    return numbers


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
        try:
            full = complete_nhs_number(nine, invalid=args.invalid)
            print(full)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.count is not None:
        nums = generate_nhs_numbers(args.count, invalid=args.invalid, dummy=args.dummy)
        for num in nums:
            print(num)


if __name__ == "__main__":
    main()

