from datetime import datetime
import json
import os
from typing import (
    Dict,
    List,
    Tuple,
    Any,
    Callable,
    Optional,
    Iterator
)

import pyperclip

from utils.pfp_requests import load_collection_entries


DEFAULT_ODS = "FA565"


def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.now().replace(microsecond=0).isoformat() + "Z"


def find_dispense_performer_ods(data: Dict[str, Any], chosen_entry: Dict[str, Any]) -> str:
    # Get the performer from the chosen entry.
    performer_id = chosen_entry.get("dispenseRequest", {}).get('performer', {}).get('reference')
    performer_id = performer_id.split(":")[-1] if performer_id else None

    # Now find the corresponding Organization entry
    ods_code = DEFAULT_ODS

    for e in load_collection_entries(data):
        res: Dict[str, Any] = e.get('resource', {})
        if res.get('resourceType') == 'Organization' and res.get('id') == performer_id:
            ods_code = res.get('identifier', [{}])[0].get('value')

    return ods_code


def _iter_resources(entries: List[Dict[str, Any]]) -> Iterator[Dict[str, Any]]:
    """
    Yield every resource in the bundle entries, including any nested
    resources under entry.resource.entry.
    """
    for entry in entries:
        res = entry.get("resource", {})
        yield res
        for nested in res.get("entry", []):
            yield nested.get("resource", {})


def find_nhs_number(entries: List[Dict[str, Any]]) -> str:
    """
    Find the NHS number in order of:
      1. MedicationRequest.subject.identifier
      2. Patient.identifier
      3. Task.for.identifier
    Returns 'unknown-nhs-number' if none found.
    """
    # Doing these as lambdas caused pylance to complain, and I cba to fix it
    def extract_medication_request(r: Dict[str, Any]) -> Optional[str]:
        return r.get("subject", {}).get("identifier", [{}])[0].get("value")

    def extract_patient(r: Dict[str, Any]) -> Optional[str]:
        return r.get("identifier", [{}])[0].get("value")

    def extract_task(r: Dict[str, Any]) -> Optional[str]:
        return r.get("for", {}).get("identifier", {}).get("value")

    priority: List[Tuple[str, Callable[[Dict[str, Any]], Optional[str]]]] = [
        ("MedicationRequest", extract_medication_request),
        ("Patient", extract_patient),
        ("Task", extract_task),
    ]

    for resource_type, extractor in priority:
        for res in _iter_resources(entries):
            if res.get("resourceType") == resource_type:
                nhs = extractor(res)
                if nhs:
                    return nhs

    return "unknown-nhs-number"

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


def save_bundle(
    prefix: str,
    bundle: Dict[str, Any],
    save_dir: str,
    nhs_number: Optional[str] = None
) -> None:
    """
    Save the FHIR Bundle JSON to a file.
    """
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    if not nhs_number:
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
