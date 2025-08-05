import uuid
from typing import Any, Dict, Optional
import pyperclip
import json

from utils.utils import iso_now

# Following the spec from here:
# https://digital.nhs.uk/developer/api-catalogue/prescription-status-update-fhir#post-/

# Allowed NPPT business status values (canonical casing)
BUSINESS_STATUS_CHOICES = [
    "With Pharmacy",
    "With Pharmacy - Preparing Remainder",
    "Ready to Collect",
    "Ready to Collect - Partial",
    "Collected",
    "Dispatched",
    "Not Dispensed",
    "Ready to Dispatch",
    "Ready to Dispatch - Partial"
]

# Terminal statuses trigger Task.status = "completed"
TERMINAL_STATUSES = {"Collected", "Dispatched", "Not Dispensed"}


def canonical_business_status(raw: str) -> str:
    """
    Case-insensitive match of raw input to one of the canonical choices.
    Raises ValueError on no match.
    """
    rl = raw.strip().lower()
    for choice in BUSINESS_STATUS_CHOICES:
        if choice.lower() == rl:
            return choice
    raise ValueError(f"Invalid business status '{raw}'. Choose from: {', '.join(BUSINESS_STATUS_CHOICES)}")


def build_bundle(
    business_status: str,
    order_number: str,
    order_item_number: str,
    nhs_number: str,
    ods_code: str,
    last_modified: str | None = None
):
    # Map to canonical casing
    bs = canonical_business_status(business_status)
    # Determine Task.status
    status = "completed" if bs in TERMINAL_STATUSES else "in-progress"

    task_id = str(uuid.uuid4())
    bundle: dict[str, Any] = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {
                "fullUrl": f"urn:uuid:{task_id}",
                "resource": {
                    "resourceType": "Task",
                    "id": task_id,
                    "basedOn": [
                        {
                            "identifier": {
                                "system": "https://fhir.nhs.uk/Id/prescription-order-number",
                                "value": order_number
                            }
                        }
                    ],
                    "status": status,
                    "businessStatus": {
                        "coding": [
                            {
                                "system": "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                                "code": bs
                            }
                        ]
                    },
                    "intent": "order",
                    "focus": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/prescription-order-item-number",
                            "value": order_item_number
                        }
                    },
                    "for": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/nhs-number",
                            "value": nhs_number
                        }
                    },
                    "lastModified": last_modified or iso_now(),
                    "owner": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                            "value": ods_code
                        }
                    }
                },
                "request": {
                    "method": "POST",
                    "url": "Task"
                }
            }
        ]
    }
    return bundle


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
