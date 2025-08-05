import random
import string


def generate_ODS_code(length: int = 5) -> str:
    """Generate a random ODS code of specified length."""
    if length < 3 or length > 6:
        raise ValueError("ODS code length must be between 3 and 5 characters.")

    # ODS code of the format "ANN", "AANNN", or "ANNNNN", where A is an uppercase letter and N is a digit.
    letters = string.ascii_uppercase
    digits = string.digits

    if length == 3:
        return ''.join(random.choice(letters) for _ in range(2)) + random.choice(digits)
    elif length == 4:
        return ''.join(random.choice(letters) for _ in range(1)) + ''.join(random.choice(digits) for _ in range(3))
    elif length == 5:
        return ''.join(random.choice(letters) for _ in range(2)) + ''.join(random.choice(digits) for _ in range(3))
    elif length == 6:
        return ''.join(random.choice(letters) for _ in range(1)) + ''.join(random.choice(digits) for _ in range(5))
    else:
        raise ValueError("ODS code length must be between 3 and 5 characters.")
