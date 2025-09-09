import uuid
from typing import Any
import time
import requests
import jwt

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


def build_psu_bundle(
    entries: list[dict[str, Any]]
):
    bundle: dict[str, Any] = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": entries
    }

    return bundle


def build_psu_entry(
    business_status: str,
    order_number: str,
    order_item_number: str,
    nhs_number: str,
    ods_code: str,
    last_modified: str | None = None
):
    bs = canonical_business_status(business_status)
    # Determine Task.status - this is defined by buisness logic not the user
    status = "completed" if bs in TERMINAL_STATUSES else "in-progress"

    task_id = str(uuid.uuid4())
    entry: dict[str, Any] = {
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
    return entry



def obtain_access_token(host: str, api_key: str, kid: str, private_key: str) -> str:
    auth_url = f"https://{host}/oauth2/token"
    # JWT header & payload
    header = { 'typ': 'JWT', 'alg': 'RS512', 'kid': kid }
    now = int(time.time())
    payload: dict[str, Any] = {
        'sub': api_key,
        'iss': api_key,
        'jti': str(uuid.uuid4()),
        'aud': auth_url,
        'exp': now + 180
    }
    assertion: str = jwt.encode(
        payload,
        private_key,
        algorithm='RS512',
        headers=header
    )
    # Request token
    resp = requests.post(
        auth_url,
        headers={ 'Content-Type': 'application/x-www-form-urlencoded' },
        data={
            'grant_type': 'client_credentials',
            'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion': assertion
        }
    )
    resp.raise_for_status()
    return resp.json().get('access_token')


def send_psu(host: str, token: str, bundle: str | dict[str, Any]) -> tuple[requests.Response, str, str]:
    url = f"https://{host}/prescription-status-update/"
    # x-request-id & x-correlation-id
    request_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'x-request-id': request_id,
        'x-correlation-id': correlation_id
    }
    resp = requests.post(url, headers=headers, json=bundle)
    return resp, request_id, correlation_id
