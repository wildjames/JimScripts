from datetime import datetime, timezone
import random
import string
from typing import Dict, Any, List, Optional
from uuid import uuid4

from faker import Faker

from utils.psu_requests import build_psu_bundle, build_psu_entry, canonical_business_status


HEX_CHARS = '0123456789ABCDEF'
fake = Faker('en_GB')

# For generating prescription IDs
PRESCRIPTION_ID_CHECK_DIGIT_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+"

# Multipliers for the first 9 digits
NHS_NUMBER_WEIGHTS = list(range(10, 1, -1))  # [10, 9, ..., 2]


def calculate_check_digit(nine_digits: str) -> int:
    """
    Calculate the check digit for the first nine digits of an NHS number.

    https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html

    Args:
        nine_digits (str): A string of 9 numeric characters.

    Returns:
        int: The check digit (0-9).

    Raises:
        ValueError: If any character in nine_digits is not a digit, or if the computed check digit is invalid (i.e., 10).
    """
    if len(nine_digits) != 9 or not nine_digits.isdigit():
        raise ValueError(f"Input must be exactly 9 digits. Got {len(nine_digits)}")

    total = sum(int(d) * w for d, w in zip(nine_digits, NHS_NUMBER_WEIGHTS))
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

    https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html
    """
    cd = calculate_check_digit(nine_digits)
    if invalid:
        # Pick a digit (0-9) that isn't the correct one
        choices = [d for d in range(10) if d != cd]
        cd = random.choice(choices)
    return nine_digits + str(cd)


def generate_nhs_number(invalid: bool = False, dummy: bool = False) -> str:
    """
    Generate a single NHS number.

    https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html

    Args:
        invalid (bool): If True, generate a number with an incorrect check digit.
        dummy (bool): If True, the number starts with '999'.

    Returns:
        str: Generated NHS number.
    """
    if dummy:
        prefix = '999'
        body = ''.join(str(random.randint(0, 9)) for _ in range(6))
        nine = prefix + body
    else:
        nine = ''.join(str(random.randint(0, 9)) for _ in range(9))
    try:
        return complete_nhs_number(nine, invalid=invalid)
    except:
        # if this is not a valid number, try again
        return generate_nhs_number(invalid, dummy)


def generate_nhs_numbers(count: int, invalid: bool = False, dummy: bool = False) -> list[str]:
    """
    Generate a list of NHS numbers.

    https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html

    Args:
        count (int): How many numbers to generate.
        invalid (bool): If True, generate numbers with incorrect check digits.
        dummy (bool): If True, numbers start with '999'.

    Returns:
        list: Generated NHS numbers.
    """
    numbers: list[str] = []
    while len(numbers) < count:
        try:
            full = generate_nhs_number(invalid=invalid, dummy=dummy)
        except ValueError:
            # skip invalid base sequences and retry
            continue
        numbers.append(full)
    return numbers


def validate_nhs_number(nhs_number: str) -> bool:
    """
    Validate an NHS number by checking its format and check digit.

    Args:
        nhs_number (str): The NHS number to validate.

    Returns:
        bool: True if valid, False otherwise.
    """
    if len(nhs_number) != 10 or not nhs_number.isdigit():
        return False
    try:
        expected_cd = calculate_check_digit(nhs_number[:9])
        return expected_cd == int(nhs_number[9])
    except ValueError:
        return False


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


def generate_prescription_id(ods_code: Optional[str] = None) -> str:
    """
    Generate a prescription order number in format: [6 hex]-[ODS]-[5 hex][check digit]
    """
    # Generate 12 random alphanumeric chars (A-Z, 0-9)
    chars = string.ascii_uppercase + string.digits
    core = ''.join(random.choice(chars) for _ in range(11))

    ods_code = ods_code or generate_ODS_code(6)

    formatted = f"{core[:6]}-{ods_code}-{core[6:]}"
    check_digit = compute_presc_id_check_digit(formatted)
    return formatted + check_digit

def calculate_presc_id_check_digit_total(input_str: str) -> int:
    total = 0
    input_str = input_str.replace('-', '')
    for char in input_str:
        total = ((total + int(char, 36)) * 2) % 37
    return total


def compute_presc_id_check_digit(prescription_id: str) -> str:
    total = calculate_presc_id_check_digit_total(prescription_id)
    # Find a check digit such that (total + value) % 37 == 1
    for i, ch in enumerate(PRESCRIPTION_ID_CHECK_DIGIT_VALUES):
        if (total + i) % 37 == 1:
            return ch
    raise ValueError("No valid check digit found")


def generate_patient_data() -> Dict[str, Any]:
    """
    Generate random patient demographic info.
    Returns dict with name, gender, birthDate, address lines, postalCode.
    """
    gender = random.choice(['male', 'female'])

    # Trans rights might be human rights, but for this synthetic data I cba to simulate them
    if gender == 'male':
        first = fake.first_name_male()
        prefix = 'Mr'
    else:
        first = fake.first_name_female()
        prefix = random.choice(['Ms', 'Mrs', 'Miss'])

    last = fake.last_name().upper()

    birthdate = fake.date_between(start_date='-90y', end_date='-18y').isoformat()

    street = fake.street_address().upper()
    city = fake.city().upper()
    county = fake.county().upper()
    postal = fake.postcode().upper()

    return {
        'prefix': prefix,
        'given': [first.upper()],
        'family': last,
        'gender': gender,
        'birthDate': birthdate,
        'address': [street, city, county],
        'postalCode': postal
    }


def generate_practitioner_data(ods: Optional[str]) -> Dict[str, Any]:
    """
    Generate random practitioner demographic and identifier info.
    Returns dict with name, identifiers, phone.
    """
    # Identifiers

    # In theory, I think these mock values work. However, in practice they break the spine box.
    # I'll use hardcoded values, but leave this here for posterity in case I need to revisit.
    # https://simplifier.net/guide/UKNamingSystems/Home/Identifiersystems/IndexofIdentifierNamingsystems?version=current#SDSUserID
    # https://simplifier.net/packages/uk.nhsdigital.r4/2.11.0/files/2781522/~overview
    # This is not helpful, but examples look like they might be 12 digits and start with 555?
    sds_user = "555" + str(fake.random_number(digits=9, fix_len=True))
    # 200102238987
    sds_role = str(fake.random_number(digits=12, fix_len=True))
    # https://simplifier.net/guide/UKNamingSystems/Home/Identifiersystems/IndexofIdentifierNamingsystems?version=current#GMCNumber
    gmc = f"C{random.randint(0, 9999999):07d}"
    # https://archive.datadictionary.nhs.uk/DD%20Release%20June%202021/attributes/doctor_index_number.html
    din = str(fake.random_number(digits=6, fix_len=True))

    # sds_user = "555086689106"
    # gmc = "6095103"
    # din = "977677"

    return {
        'prefix': 'Dr',
        'given': [fake.first_name().upper()],
        'family': fake.last_name().upper(),
        'identifiers': {
            'sds_user_id': sds_user,
            'sds_role_id': sds_role,
            'gmc_number': gmc,
            'din_number': din
        },
        'phone': fake.phone_number(),
        'ods_code': ods if ods else generate_ODS_code(6)
    }


def generate_psu_request_bundle(
    business_status: str,
    nhs_number: Optional[str] = None,
    ods_code: Optional[str] = None,
    order_number: Optional[str] = None,
    order_item_number: Optional[str] = None,
    last_modified: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a minimal FHIR Bundle for a PSU request.
    """
    nhs_number = nhs_number or generate_nhs_number(dummy=False, invalid=False)

    ods_code = ods_code or generate_ODS_code(5)
    order_number = generate_prescription_id(ods_code)
    order_item_number = order_item_number or str(uuid4())

    business_status = canonical_business_status(business_status)

    print("Generating PSU request with:")
    print(f"  NHS number: {nhs_number}")
    print(f"  ODS code: {ods_code}")
    print(f"  Order number: {order_number}")
    print(f"  Order item number: {order_item_number}")

    entry = build_psu_entry(
        business_status=business_status,
        order_number=order_number,
        order_item_number=order_item_number,
        nhs_number=nhs_number,
        ods_code=ods_code,
        last_modified=last_modified
    )

    return build_psu_bundle([entry])


def generate_psu_request_multi_prescription_bundle(
    business_status: str,
    count: int,
    ods_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a minimal FHIR Bundle for a PSU request.
    """
    entries: List[Dict[str, Any]] = []

    for _ in range(count):
        nhs_number = generate_nhs_number(dummy=False, invalid=False)

        this_ods_code = ods_code or generate_ODS_code(5)
        order_number = generate_prescription_id(ods_code)
        order_item_number = str(uuid4())

        business_status = canonical_business_status(business_status)

        last_modified = datetime.now(timezone.utc).isoformat()

        print("Generating PSU request with:")
        print(f"  NHS number: {nhs_number}")
        print(f"  ODS code: {ods_code}")
        print(f"  Order number: {order_number}")
        print(f"  Order item number: {order_item_number}\n")

        entry = build_psu_entry(
            business_status=business_status,
            order_number=order_number,
            order_item_number=order_item_number,
            nhs_number=nhs_number,
            ods_code=this_ods_code,
            last_modified=last_modified
        )

        entries.append(entry)

    return build_psu_bundle(entries)
