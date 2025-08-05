#!/usr/bin/env python3
"""
Generate a FHIR Bundle JSON for a prescription order message interactively.

Should be able to be pasted directly into EPSAT's custom Create A Prescription box.
"""
import random
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List
import argparse

from utils.ODS import generate_ODS_code
from utils.nhs_numbers import generate_nhs_numbers
from utils.utils import output_bundle


HEX_CHARS = '0123456789ABCDEF'


def generate_order_number(ods_code: str) -> str:
    """
    Generate a prescription order number in format: <6 uppercase hex>-<ODS>-<6 uppercase hex>
    """
    prefix = ''.join(random.choice(HEX_CHARS) for _ in range(6))
    suffix = ''.join(random.choice(HEX_CHARS) for _ in range(6))
    return f"{prefix}-{ods_code}-{suffix}"


def create_message_bundle(nhs_number: str, pharmacy_ods: str, count: int) -> Dict[str, Any]:
    # GP practice details (hardcoded example)
    gp_ods = generate_ODS_code(6)
    gp_name = "HALLGARTH SURGERY"
    pharmacy_endpoint = "https://sandbox.api.service.nhs.uk/fhir-prescribing/$post-message"

    # Sample medications
    sample_meds: List[Dict[str, Any]] = [
        {
            "code": "39732311000001104",
            "display": "Amoxicillin 250mg capsules",
            "quantity": 20,
            "dosage_text": "2 times a day for 10 days",
            "frequency": 2,
            "period": 1,
            "periodUnit": "d"
        },
        {
            "code": "322341003",
            "display": "Co-codamol 30mg/500mg tablets",
            "quantity": 20,
            "dosage_text": "2 times a day for 10 days",
            "frequency": 2,
            "period": 1,
            "periodUnit": "d"
            },
        {
            "code": "321080004",
            "display": "Pseudoephedrine hydrochloride 60mg tablets",
            "quantity": 30,
            "dosage_text": "3 times a day for 10 days",
            "frequency": 3,
            "period": 1,
            "periodUnit": "d"
            },
        {
            "code": "324252006",
            "display": "Azithromycin 250mg capsules",
            "quantity": 30,
            "dosage_text": "3 times a day for 10 days",
            "frequency": 3,
            "period": 1,
            "periodUnit": "d"
            }
    ]

    # Generate unique identifiers
    bundle_id = str(uuid.uuid4())
    message_identifier = str(uuid.uuid4())
    header_uuid = str(uuid.uuid4())
    group_order_number = generate_order_number(gp_ods)
    prescription_id = str(uuid.uuid4())

    # Prepare resource entries
    med_requests: List[Dict[str, Any]] = []
    focus_references: List[Dict[str, str]] = []

    # Fixed resource IDs for patient, practitioner, role, organization
    patient_uuid = str(uuid.uuid4())
    practitioner_uuid = str(uuid.uuid4())
    practitioner_role_uuid = str(uuid.uuid4())
    org_uuid = str(uuid.uuid4())

    # Build MedicationRequest entries
    for i in range(count):
        med = sample_meds[i % len(sample_meds)]
        mr_uuid = str(uuid.uuid4())
        focus_references.append({"reference": f"urn:uuid:{mr_uuid}"})

        med_req: Dict[str, Any] = {
            "fullUrl": f"urn:uuid:{mr_uuid}",
            "resource": {
                "resourceType": "MedicationRequest",
                "extension": [
                    {
                        "url": "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionType",
                        "valueCoding": {
                            "system": "https://fhir.nhs.uk/CodeSystem/prescription-type",
                            "code": "0101",
                            "display": "Primary Care Prescriber - Medical Prescriber"
                        }
                    }
                ],
                "identifier": [
                    {
                        "system": "https://fhir.nhs.uk/Id/prescription-order-item-number",
                        "value": mr_uuid
                    }
                ],
                "status": "active",
                "intent": "order",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
                                "code": "community",
                                "display": "Community"
                            }
                        ]
                    }
                ],
                "medicationCodeableConcept": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": med["code"],
                            "display": med["display"]
                        }
                    ]
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
                                "value": prescription_id
                            }
                        }
                    ]
                },
                "courseOfTherapyType": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                            "code": "acute",
                            "display": "Short course (acute) therapy"
                        }
                    ]
                },
                "dosageInstruction": [
                    {
                        "text": med["dosage_text"],
                        "timing": {
                            "repeat": {
                                "frequency": med["frequency"],
                                "period": med["period"],
                                "periodUnit": med["periodUnit"]
                            }
                        },
                        "route": {
                            "coding": [
                                {
                                    "system": "http://snomed.info/sct",
                                    "code": "26643006",
                                    "display": "Oral"
                                }
                            ]
                        }
                    }
                ],
                "dispenseRequest": {
                    "extension": [
                        {
                            "url": "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PerformerSiteType",
                            "valueCoding": {
                                "system": "https://fhir.nhs.uk/CodeSystem/dispensing-site-preference",
                                "code": "P1"
                            }
                        }
                    ],
                    "validityPeriod": {
                        "start": datetime.now().date().isoformat(),
                        "end": (datetime.now().date() + timedelta(days=30)).isoformat()
                    },
                    "quantity": {
                        "value": med["quantity"],
                        "unit": "tablet",
                        "system": "http://snomed.info/sct",
                        "code": "428673006"
                    },
                    "expectedSupplyDuration": {
                        "value": med["period"] * med["frequency"],
                        "unit": "day",
                        "system": "http://unitsofmeasure.org",
                        "code": "d"
                    },
                    "performer": {
                        "identifier": {
                            "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                            "value": pharmacy_ods
                        }
                    }
                },
                "substitution": {"allowedBoolean": False}
            }
        }
        med_requests.append(med_req)

    # Patient resource entry
    patient_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{patient_uuid}",
        "resource": {
            "resourceType": "Patient",
            "identifier": [
                {"system": "https://fhir.nhs.uk/Id/nhs-number", "value": nhs_number}
            ],
            "name": [
                {"use": "usual", "family": "TWITCHETT", "given": ["STACEY", "MARISA"], "prefix": ["MS"]}
            ],
            "gender": "female",
            "birthDate": "1948-04-30",
            "address": [
                {"use": "home", "line": ["10 HEATHFIELD", "COBHAM", "SURREY"], "postalCode": "KT11 2QY"}
            ],
            "generalPractitioner": [
                {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": gp_ods}}
            ]
        }
    }

    # PractitionerRole entry
    practitioner_role_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{practitioner_role_uuid}",
        "resource": {
            "resourceType": "PractitionerRole",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/sds-role-profile-id", "value": "200102238987"}],
            "practitioner": {"reference": f"urn:uuid:{practitioner_uuid}"},
            "organization": {"reference": f"urn:uuid:{org_uuid}"},
            "code": [
                {"coding": [
                    {"system": "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode", "code": "R8000", "display": "Clinical Practitioner Access Role"},
                    {"system": "https://fhir.hl7.org.uk/CodeSystem/UKCore-SDSJobRoleName", "code": "R8000", "display": "Clinical Practitioner Access Role"}
                ]}
            ],
            "telecom": [{"system": "phone", "use": "work", "value": "01234567890"}]
        }
    }

    # Practitioner entry
    practitioner_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{practitioner_uuid}",
        "resource": {
            "resourceType": "Practitioner",
            "identifier": [
                {"system": "https://fhir.nhs.uk/Id/sds-user-id", "value": "555086689106"},
                {"system": "https://fhir.hl7.org.uk/Id/gmc-number", "value": "6095103"},
                {"system": "https://fhir.hl7.org.uk/Id/din-number", "value": "977677"}
            ],
            "name": [{"family": "BOIN", "given": ["C"], "prefix": ["DR"]}]
        }
    }

    # Organization entry
    organization_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{org_uuid}",
        "resource": {
            "resourceType": "Organization",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": gp_ods}],
            "type": [{"coding": [{"system": "https://fhir.nhs.uk/CodeSystem/organisation-role", "code": "76", "display": "GP PRACTICE"}]}],
            "name": gp_name,
            "telecom": [{"system": "phone", "use": "work", "value": "0115 9737320"}],
            "address": [{"use": "work", "type": "both", "line": [gp_name, "CHEAPSIDE"], "city": "SHILDON", "district": "COUNTY DURHAM", "postalCode": "DL4 2HP"}],
            "partOf": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": "84H"}, "display": "NHS COUNTY DURHAM CCG"}
        }
    }

    # MessageHeader entry
    header_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{header_uuid}",
        "resource": {
            "resourceType": "MessageHeader",
            "eventCoding": {"system": "https://fhir.nhs.uk/CodeSystem/message-event", "code": "prescription-order", "display": "Prescription Order"},
            "destination": [{"endpoint": pharmacy_endpoint, "receiver": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": pharmacy_ods}, "display": pharmacy_ods}}],
            "sender": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": gp_ods}, "display": gp_name},
            "source": {"endpoint": f"https://directory.spineservices.nhs.uk/STU3/Organization/{gp_ods}"},
            "focus": focus_references
        }
    }

    # Assemble the bundle
    bundle: Dict[str, Any] = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "identifier": {"system": "https://tools.ietf.org/html/rfc4122", "value": message_identifier},
        "type": "message",
        "entry": [header_entry] + med_requests + [patient_entry, practitioner_role_entry, practitioner_entry, organization_entry]
    }

    return bundle


def main():
    parser = argparse.ArgumentParser(description="Generate a FHIR Bundle JSON for a prescription order message.")
    parser.add_argument(
        "--nhs-number",
        help="Patient's NHS number",
        required=False,
    )
    parser.add_argument(
        "--pharmacy-ods",
        required=False,
        help="Pharmacy ODS organization code",
    )
    parser.add_argument(
        "-n", "--count",
        type=int,
        help="Number of prescriptions to create",
        default=1,
    )
    args = parser.parse_args()

    if not args.nhs_number:
        nhs_number = generate_nhs_numbers(1, dummy=True)[0]
        print(f"Generated NHS number: {nhs_number}")
    else:
        nhs_number = args.nhs_number

    if not args.pharmacy_ods:
        pharmacy_ods = generate_ODS_code()
        print(f"Generated Pharmacy ODS code: {pharmacy_ods}")
    else:
        pharmacy_ods = args.pharmacy_ods

    bundle = create_message_bundle(nhs_number, pharmacy_ods, args.count)
    output_bundle(bundle, True, None)


if __name__ == "__main__":
    main()
