from datetime import datetime
import json
import os
import sys
from typing import Dict, List, Any, Optional

import pyperclip


DEFAULT_ODS = "FA565"


def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.now().replace(microsecond=0).isoformat() + "Z"


def find_default_ods(entries: List[Dict[str, Any]]) -> str:
    for e in entries:
        res = e.get('resource', {})
        if res.get('resourceType') == 'Organization':
            for ident in res.get('identifier', []):
                if ident.get('system', '').endswith('/ods-organization-code'):
                    return ident.get('value')
    return DEFAULT_ODS


def output_bundle(
    bundle: Dict[str, Any],
    to_clip: bool,
    filepath: Optional[str]
):
    serialized = json.dumps(bundle, indent=2)
    if to_clip:
        pyperclip.copy(serialized)
        print("Bundle copied to clipboard.")
    if filepath:
        with open(filepath, 'w') as f:
            f.write(serialized)
        print(f"Bundle saved to {filepath}")
    if not to_clip and not filepath:
        print(serialized)


def save_bundle(prefix: str, bundle: Dict[str, Any], save_dir: str) -> None:
    """
    Save the FHIR Bundle JSON to a file.
    """
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    nhs_number = "unknown-nhs-number"
    ods_code = "unknown-ods-code"
    for entry in bundle['entry']:
        if entry['resource']['resourceType'] == 'Patient':
            nhs_number = entry['resource']['identifier'][0]['value']
        elif entry['resource']['resourceType'] == 'Organization':
            ods_code = entry['resource']['identifier'][0]['value']

    ts = datetime.now().strftime("%Y%m%d%H%M%S")

    file_path = os.path.join(save_dir, f"{prefix}_nhs-num-{nhs_number}_ods-code-{ods_code}_gentime-{ts}.json")
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


def load_bundle(input_path: str | None = None) -> Dict[str, Any]:
    if input_path:
        with open(input_path, 'r') as f:
            return json.load(f)
    else:
        # TODO: I don't think this works... fix it
        data = sys.stdin.read()
        return json.loads(data)
