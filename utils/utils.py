from datetime import datetime
import json
import os
from typing import Dict, List, Any

import pyperclip


DEFAULT_ODS = "FA565"


def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.now().replace(microsecond=0).isoformat() + "Z"


def find_dispense_performer_ods(entries: List[Dict[str, Any]], chosen_entry: Dict[str, Any]) -> str:
    # Get the performer from the chosen entry.
    performer_id = chosen_entry.get("dispenseRequest", {}).get('performer', {}).get('reference')
    performer_id = performer_id.split(":")[-1] if performer_id else None

    # Now find the corresponding Organization entry
    ods_code = DEFAULT_ODS
    for e in entries:
        res: Dict[str, Any] = e.get('resource', {})
        if res.get('resourceType') == 'Organization' and res.get('id') == performer_id:
            ods_code = res.get('identifier', [{}])[0].get('value')

    return ods_code


def find_nhs_number(entries: List[Dict[str, Any]]) -> str:
    """Find the NHS number from the entries."""
    for e in entries:
        resource_entries: List[Dict[str, Any]] = e.get('resource', {}).get("entry", [{}])
        for entry in resource_entries:
            res = entry.get('resource', {})
            if res.get('resourceType') == 'MedicationRequest':
                return res.get("subject", {}).get('identifier', [{}]).get('value', 'unknown-nhs-number')
    return 'unknown-nhs-number'


def output_bundle(
    bundle: Dict[str, Any],
    to_clip: bool,
    dense: bool = False
):
    indent = 2 if not dense else None
    serialized = json.dumps(bundle, indent=indent)

    if to_clip:
        pyperclip.copy(serialized)
        print("Bundle copied to clipboard.")
    else:
        print(serialized)


def save_bundle(prefix: str, bundle: Dict[str, Any], save_dir: str) -> None:
    """
    Save the FHIR Bundle JSON to a file.
    """
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    nhs_number = find_nhs_number(bundle['entry'])

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")

    file_path = os.path.join(save_dir, f"{prefix}_{ts}_nhs-num-{nhs_number}.json")
    with open(file_path, 'w') as f:
        json.dump(bundle, f, indent=2)

    print(f"FHIR Bundle saved to {file_path}")


def load_private_key() -> str:
    key = os.getenv("PRIVATE_KEY")
    path = os.getenv("PRIVATE_KEY_PATH")
    if key:
        return key.replace('\\n', '\n')
    if path and os.path.isfile(path):
        with open(path, 'r') as f:
            return f.read()
    raise ValueError("set PRIVATE_KEY or PRIVATE_KEY_PATH in your .env")


def get_env(var: str) -> str:
    val = os.getenv(var)
    if not val:
        raise ValueError(f"{var} not set in .env")
    return val


def load_bundle(input_path: str) -> Dict[str, Any]:
    with open(input_path, 'r') as f:
        return json.load(f)
