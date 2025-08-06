from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import uuid

from utils.data_generators import (
    generate_order_number,
    generate_patient_data,
    generate_practitioner_data,
    generate_ODS_code,
)

def create_prescription_message_bundle(
    nhs_number: str,
    count: int,
    pharmacy_ods: Optional[str],
    practitioner_ods: Optional[str]
) -> Dict[str, Any]:
    # GP practice details
    gp_name = "HALLGARTH SURGERY"
    pharmacy_endpoint = "https://sandbox.api.service.nhs.uk/fhir-prescribing/$post-message"

    if not pharmacy_ods:
        pharmacy_ods = generate_ODS_code()
        print(f"Generated Pharmacy ODS code: {pharmacy_ods}")

    # Generate person and practitioner data
    patient_data = generate_patient_data()
    practitioner_data = generate_practitioner_data(practitioner_ods)

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
    group_order_number = generate_order_number(practitioner_data["ods_code"])
    prescription_id = str(uuid.uuid4())

    # Prepare the MedicationRequest entries
    med_requests: List[Dict[str, Any]] = []
    focus_references: List[Dict[str, str]] = []

    # Resource IDs
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
                        # hardcoded to 30 days for simplicity
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

    # Patient entry
    patient_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{patient_uuid}",
        "resource": {
            "resourceType": "Patient",
            "identifier": [
                {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": nhs_number
                }
            ],
            "name": [
                {
                    "use": "usual",
                    "family": patient_data['family'],
                    "given": patient_data['given'],
                    "prefix": [patient_data['prefix']]
                }
            ],
            "gender": patient_data['gender'],
            "birthDate": patient_data['birthDate'],
            "address": [
                {
                    "use": "home",
                    "line": patient_data['address'],
                    "postalCode": patient_data['postalCode']
                }
            ],
            "generalPractitioner": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": practitioner_data["ods_code"]
                    }
                }
            ]
        }
    }

    # PractitionerRole entry
    practitioner_role_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{practitioner_role_uuid}",
        "resource": {
            "resourceType": "PractitionerRole",
            "identifier": [
                {
                    "system": "https://fhir.nhs.uk/Id/sds-role-profile-id",
                    "value": "200102238987"
                }
            ],
            "practitioner": {
                "reference": f"urn:uuid:{practitioner_uuid}"
            },
            "organization": {
                "reference": f"urn:uuid:{org_uuid}"
            },
            "code": [
                {
                    "coding": [
                        {
                            "system": "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode",
                            "code": "R8000",
                            "display": "Clinical Practitioner Access Role"
                        },
                        {
                            "system": "https://fhir.hl7.org.uk/CodeSystem/UKCore-SDSJobRoleName",
                            "code": "R8000",
                            "display": "Clinical Practitioner Access Role"
                        }
                    ]
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "use": "work",
                    "value": practitioner_data['phone']
                }
            ]
        }
    }

    # Practitioner entry
    practitioner_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{practitioner_uuid}",
        "resource": {
            "resourceType": "Practitioner",
            "identifier": [
                {
                    "system": "https://fhir.nhs.uk/Id/sds-user-id",
                    "value": practitioner_data['identifiers']['sds_user_id']
                },
                {
                    "system": "https://fhir.hl7.org.uk/Id/gmc-number",
                    "value": practitioner_data['identifiers']['gmc_number']
                },
                {
                    "system": "https://fhir.hl7.org.uk/Id/din-number",
                    "value": practitioner_data['identifiers']['din_number']
                }
            ],
            "name": [
                {
                    "family": practitioner_data['family'],
                    "given": practitioner_data['given'],
                    "prefix": [
                        practitioner_data['prefix']
                    ]
                }
            ]
        }
    }


    # Organization entry
    organization_entry: Dict[str, Any] = {
        "fullUrl": f"urn:uuid:{org_uuid}",
        "resource": {
            "resourceType": "Organization",
            "identifier": [{"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": practitioner_data["ods_code"]}],
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
            "sender": {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code", "value": practitioner_data["ods_code"]}, "display": gp_name},
            "source": {"endpoint": f"https://directory.spineservices.nhs.uk/STU3/Organization/{practitioner_data["ods_code"]}"},
            "focus": focus_references
        }
    }

    # Assemble the bundle
    bundle: Dict[str, Any] = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "identifier": {"system": "https://tools.ietf.org/html/rfc4122", "value": message_identifier},
        "type": "message",
        "entry": [
            header_entry,
            *med_requests,
            patient_entry,
            practitioner_role_entry,
            practitioner_entry,
            organization_entry
        ]
    }

    return bundle
