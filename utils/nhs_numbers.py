import random

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


def generate_nhs_numbers(count: int, invalid: bool = False, dummy: bool = False) -> list[str]:
    """
    Generate a list of NHS numbers.

    Args:
        count (int): How many numbers to generate.
        invalid (bool): If True, generate numbers with incorrect check digits.
        dummy (bool): If True, numbers start with '999'.

    Returns:
        list: Generated NHS numbers.
    """
    numbers: list[str] = []
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
