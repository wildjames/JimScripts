from datetime import date, timedelta
from uuid import uuid4
from typing import Any, Dict, List, Optional

from utils.data_generators import (
    generate_prescription_id,
    generate_patient_data,
    generate_practitioner_data,
    generate_ODS_code,
)

# Constants
GP_NAME = "HALLGARTH SURGERY"
PHARMACY_ENDPOINT = "https://sandbox.api.service.nhs.uk/fhir-prescribing/$post-message"

SAMPLE_MEDICATIONS: List[Dict[str, Any]] = [
    {
        "code": "39732311000001104",
        "display": "Amoxicillin 250mg capsules",
        "quantity": 20,
        "dosage_text": "2 times a day for 10 days",
        "frequency": 2,
        "period": 1,
        "period_unit": "d",
    },
    {
        "code": "322341003",
        "display": "Co-codamol 30mg/500mg tablets",
        "quantity": 20,
        "dosage_text": "2 times a day for 10 days",
        "frequency": 2,
        "period": 1,
        "period_unit": "d",
    },
    {
        "code": "321080004",
        "display": "Pseudoephedrine hydrochloride 60mg tablets",
        "quantity": 30,
        "dosage_text": "3 times a day for 10 days",
        "frequency": 3,
        "period": 1,
        "period_unit": "d",
    },
    {
        "code": "324252006",
        "display": "Azithromycin 250mg capsules",
        "quantity": 30,
        "dosage_text": "3 times a day for 10 days",
        "frequency": 3,
        "period": 1,
        "period_unit": "d",
    },
]


def _ensure_pharmacy_ods(pharmacy_ods: Optional[str]) -> str:
    if not pharmacy_ods:
        code = generate_ODS_code()
        return code
    return pharmacy_ods


def _build_medication_requests(
    count: int,
    patient_uuid: str,
    practitioner_role_uuid: str,
    pharmacy_ods: str,
    group_order_number: str,
    prescription_id: str,
) -> List[Dict[str, Any]]:
    requests: List[Dict[str, Any]] = []

    for i in range(count):
        med = SAMPLE_MEDICATIONS[i % len(SAMPLE_MEDICATIONS)]
        mr_uuid = str(uuid4())
        today = date.today()

        med_request: Dict[str, Any] = {
            "fullUrl": f"urn:uuid:{mr_uuid}",
            "resource": {
                "resourceType": "MedicationRequest",
                "extension": [
                    {
                        "url": "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionType",
                        "valueCoding": {
                            "system": "https://fhir.nhs.uk/CodeSystem/prescription-type",
                            "code": "0101",
                            "display": "Primary Care Prescriber - Medical Prescriber",
                        },
                    }
                ],
                "identifier": [{"system": "https://fhir.nhs.uk/Id/prescription-order-item-number", "value": mr_uuid}],
                "status": "active",
                "intent": "order",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
                        "code": "community",
                        "display": "Community",
                    }]
                }],
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": med["code"],
                        "display": med["display"],
                    }]
                },
                "subject": {"reference": f"urn:uuid:{patient_uuid}"},
                "requester": {"reference": f"urn:uuid:{practitioner_role_uuid}"},
                "groupIdentifier": {
                    "system": "https://fhir.nhs.uk/Id/prescription-order-number",
                    "value": group_order_number,
                    "extension": [
                        {
                            "url": "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionId",
                            "valueIdentifier": {
                                "system": "https://fhir.nhs.uk/Id/prescription",
                                "value": prescription_id,
                            },
                        }
                    ],
                },
                "courseOfTherapyType": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                        "code": "acute",
                        "display": "Short course (acute) therapy",
                    }]
                },
                "dosageInstruction": [
                    {
                        "text": med["dosage_text"],
                        "timing": {"repeat": {
                            "frequency": med["frequency"],
                            "period": med["period"],
                            "periodUnit": med["period_unit"],
                        }},
                        "route": {"coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "26643006",
                            "display": "Oral",
                        }]},
                    }
                ],
                "dispenseRequest": {
                    "extension": [{
                        "url": "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PerformerSiteType",
                        "valueCoding": {
                            "system": "https://fhir.nhs.uk/CodeSystem/dispensing-site-preference",
                            "code": "P1",
                        },
                    }],
                    "validityPeriod": {
                        "start": today.isoformat(),
                        "end": (today + timedelta(days=30)).isoformat(),
                    },
                    "quantity": {
                        "value": med["quantity"],
                        "unit": "tablet",
                        "system": "http://snomed.info/sct",
                        "code": "428673006",
                    },
                    "expectedSupplyDuration": {
                        "value": med["period"] * med["frequency"],
                        "unit": "day",
                        "system": "http://unitsofmeasure.org",
                        "code": "d",
                    },
                    "performer": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": pharmacy_ods}},
                },
                "substitution": {"allowedBoolean": False},
            },
        }

        requests.append(med_request)
    return requests


def _build_patient_entry(
    nhs_number: str,
    patient_data: Dict[str, Any],
    practitioner_ods: str,
    patient_uuid: str,
) -> Dict[str, Any]:
    return {
        "fullUrl": f"urn:uuid:{patient_uuid}",
        "resource": {
            "resourceType": "Patient",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/nhs-number", "value": nhs_number}],
            "name": [{
                "use": "usual",
                "family": patient_data["family"],
                "given": patient_data["given"],
                "prefix": [patient_data["prefix"]],
            }],
            "gender": patient_data["gender"],
            "birthDate": patient_data["birthDate"],
            "address": [{
                "use": "home",
                "line": patient_data["address"],
                "postalCode": patient_data["postalCode"],
            }],
            "generalPractitioner": [{
                "identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": practitioner_ods}
            }],
        },
    }


def _build_practitioner_role_entry(
    practitioner_data: Dict[str, Any],
    practitioner_uuid: str,
    practitioner_role_uuid: str,
    org_uuid: str,
) -> Dict[str, Any]:
    return {
        "fullUrl": f"urn:uuid:{practitioner_role_uuid}",
        "resource": {
            "resourceType": "PractitionerRole",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/sds-role-profile-id", "value": practitioner_data["identifiers"]["sds_role_id"]}],
            "practitioner": {"reference": f"urn:uuid:{practitioner_uuid}"},
            "organization": {"reference": f"urn:uuid:{org_uuid}"},
            "code": [{"coding": [
                {"system": "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode", "code": "R8000", "display": "Clinical Practitioner Access Role"},
                {"system": "https://fhir.hl7.org.uk/CodeSystem/UKCore-SDSJobRoleName", "code": "R8000", "display": "Clinical Practitioner Access Role"},
            ]}],
            "telecom": [{"system": "phone", "use": "work", "value": practitioner_data["phone"]}],
        },
    }


def _build_practitioner_entry(
    practitioner_data: Dict[str, Any],
    practitioner_uuid: str,
) -> Dict[str, Any]:
    ids = practitioner_data["identifiers"]
    return {
        "fullUrl": f"urn:uuid:{practitioner_uuid}",
        "resource": {
            "resourceType": "Practitioner",
            "identifier": [
                {"system": "https://fhir.nhs.uk/Id/sds-user-id", "value": ids["sds_user_id"]},
                {"system": "https://fhir.hl7.org.uk/Id/gmc-number", "value": ids["gmc_number"]},
                {"system": "https://fhir.hl7.org.uk/Id/din-number", "value": ids["din_number"]},
            ],
            "name": [{"family": practitioner_data["family"], "given": practitioner_data["given"], "prefix": [practitioner_data["prefix"]]}],
        },
    }


def _build_organization_entry(
    practitioner_ods: str,
    org_uuid: str,
) -> Dict[str, Any]:
    return {
        "fullUrl": f"urn:uuid:{org_uuid}",
        "resource": {
            "resourceType": "Organization",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": practitioner_ods}],
            "type": [{"coding": [{"system": "https://fhir.nhs.uk/CodeSystem/organisation-role", "code": "76", "display": "GP PRACTICE"}]}],
            "name": GP_NAME,
            "telecom": [{"system": "phone", "use": "work", "value": "0115 9737320"}],
            "address": [{
                "use": "work",
                "type": "both",
                "line": [GP_NAME, "CHEAPSIDE"],
                "city": "SHILDON",
                "district": "COUNTY DURHAM",
                "postalCode": "DL4 2HP",
            }],
            "partOf": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": "84H"}, "display": "NHS COUNTY DURHAM CCG"},
        },
    }


def _build_header_entry(
    practitioner_ods: str,
    pharmacy_ods: str,
    header_uuid: str,
    focus_refs: List[Dict[str, str]],
) -> Dict[str, Any]:
    return {
        "fullUrl": f"urn:uuid:{header_uuid}",
        "resource": {
            "resourceType": "MessageHeader",
            "eventCoding": {"system": "https://fhir.nhs.uk/CodeSystem/message-event", "code": "prescription-order", "display": "Prescription Order"},
            "destination": [{"endpoint": PHARMACY_ENDPOINT, "receiver": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": pharmacy_ods}, "display": pharmacy_ods}}],
            "sender": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": practitioner_ods}, "display": GP_NAME},
            "source": {"endpoint": f"https://directory.spineservices.nhs.uk/STU3/Organization/{practitioner_ods}"},
            "focus": focus_refs,
        },
    }


def create_prescription_message_bundle(
    nhs_number: str,
    count: int,
    pharmacy_ods: Optional[str],
    practitioner_ods: Optional[str],
) -> Dict[str, Any]:
    # Generate people and places
    pharmacy_ods = _ensure_pharmacy_ods(pharmacy_ods)
    practitioner_data = generate_practitioner_data(practitioner_ods)
    patient_data = generate_patient_data()

    # Generate UUIDs and order numbers
    ids = {key: str(uuid4()) for key in ["bundle", "message", "header", "patient", "practitioner", "practitioner_role", "org"]}
    group_order_number = generate_prescription_id(practitioner_data["ods_code"])
    prescription_id = str(uuid4())

    # Build the medication requests
    med_requests = _build_medication_requests(
        count,
        ids["patient"],
        ids["practitioner_role"],
        pharmacy_ods,
        group_order_number,
        prescription_id,
    )
    focus_refs = [{"reference": req["fullUrl"]} for req in med_requests]

    entries: List[Dict[str, Any]] = []

    header_entry = _build_header_entry(
            practitioner_data["ods_code"],
            pharmacy_ods, ids["header"],
            focus_refs
        )
    entries.append(header_entry)

    entries.extend(med_requests)

    patient_entry = _build_patient_entry(nhs_number, patient_data, practitioner_data["ods_code"], ids["patient"])
    entries.append(patient_entry)

    practitioner_role_entry = _build_practitioner_role_entry(
        practitioner_data,
        ids["practitioner"],
        ids["practitioner_role"],
        ids["org"]
    )
    entries.append(practitioner_role_entry)

    practitioner_entry = _build_practitioner_entry(practitioner_data, ids["practitioner"])
    entries.append(practitioner_entry)

    org_entry = _build_organization_entry(practitioner_data["ods_code"], ids["org"])
    entries.append(org_entry)

    return {
        "resourceType": "Bundle",
        "id": ids["bundle"],
        "identifier": {"system": "https://tools.ietf.org/html/rfc4122", "value": ids["message"]},
        "type": "message",
        "entry": entries,
    }
