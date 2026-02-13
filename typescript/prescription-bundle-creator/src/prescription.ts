import {randomUUID} from "crypto";
import type {PatientData, PractitionerData} from "./generators.js";
import {
  generateOdsCode,
  generatePatientData,
  generatePractitionerData,
  generatePrescriptionId
} from "./generators.js";

// Constants
const GP_NAME = "HALLGARTH SURGERY";
const PHARMACY_ENDPOINT = "https://sandbox.api.service.nhs.uk/fhir-prescribing/$post-message";

interface Medication {
  code: string;
  display: string;
  quantity: number;
  dosageText: string;
  frequency: number;
  period: number;
  periodUnit: string;
}

const SAMPLE_MEDICATIONS: Medication[] = [
  {
    code: "39732311000001104",
    display: "Amoxicillin 250mg capsules",
    quantity: 20,
    dosageText: "2 times a day for 10 days",
    frequency: 2,
    period: 1,
    periodUnit: "d",
  },
  {
    code: "322341003",
    display: "Co-codamol 30mg/500mg tablets",
    quantity: 20,
    dosageText: "2 times a day for 10 days",
    frequency: 2,
    period: 1,
    periodUnit: "d",
  },
  {
    code: "321080004",
    display: "Pseudoephedrine hydrochloride 60mg tablets",
    quantity: 30,
    dosageText: "3 times a day for 10 days",
    frequency: 3,
    period: 1,
    periodUnit: "d",
  },
  {
    code: "324252006",
    display: "Azithromycin 250mg capsules",
    quantity: 30,
    dosageText: "3 times a day for 10 days",
    frequency: 3,
    period: 1,
    periodUnit: "d",
  },
];

function ensurePharmacyOds(pharmacyOds?: string): string {
  if (!pharmacyOds) {
    return generateOdsCode();
  }
  return pharmacyOds;
}

function buildMedicationRequests(
  count: number,
  patientUuid: string,
  practitionerRoleUuid: string,
  pharmacyOds: string,
  groupOrderNumber: string,
  prescriptionId: string
): any[] {
  const requests: any[] = [];

  for (let i = 0; i < count; i++) {
    const med = SAMPLE_MEDICATIONS[i % SAMPLE_MEDICATIONS.length];
    const mrUuid = randomUUID();
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    const endDateIso = endDate.toISOString().split('T')[0];

    const medRequest: any = {
      fullUrl: `urn:uuid:${mrUuid}`,
      resource: {
        resourceType: "MedicationRequest",
        extension: [
          {
            url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionType",
            valueCoding: {
              system: "https://fhir.nhs.uk/CodeSystem/prescription-type",
              code: "0101",
              display: "Primary Care Prescriber - Medical Prescriber",
            },
          }
        ],
        identifier: [
          {
            system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
            value: mrUuid
          }
        ],
        status: "active",
        intent: "order",
        category: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
            code: "community",
            display: "Community",
          }]
        }],
        medicationCodeableConcept: {
          coding: [{
            system: "http://snomed.info/sct",
            code: med.code,
            display: med.display,
          }]
        },
        subject: {reference: `urn:uuid:${patientUuid}`},
        requester: {reference: `urn:uuid:${practitionerRoleUuid}`},
        groupIdentifier: {
          system: "https://fhir.nhs.uk/Id/prescription-order-number",
          value: groupOrderNumber,
          extension: [
            {
              url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionId",
              valueIdentifier: {
                system: "https://fhir.nhs.uk/Id/prescription",
                value: prescriptionId,
              },
            }
          ],
        },
        courseOfTherapyType: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
            code: "acute",
            display: "Short course (acute) therapy",
          }]
        },
        dosageInstruction: [
          {
            text: med.dosageText,
            timing: {
              repeat: {
                frequency: med.frequency,
                period: med.period,
                periodUnit: med.periodUnit,
              }
            },
            route: {
              coding: [{
                system: "http://snomed.info/sct",
                code: "26643006",
                display: "Oral",
              }]
            },
          }
        ],
        dispenseRequest: {
          extension: [{
            url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PerformerSiteType",
            valueCoding: {
              system: "https://fhir.nhs.uk/CodeSystem/dispensing-site-preference",
              code: "P1",
            },
          }],
          validityPeriod: {
            start: todayIso,
            end: endDateIso,
          },
          quantity: {
            value: med.quantity,
            unit: "tablet",
            system: "http://snomed.info/sct",
            code: "428673006",
          },
          expectedSupplyDuration: {
            value: med.period * med.frequency,
            unit: "day",
            system: "http://unitsofmeasure.org",
            code: "d",
          },
          performer: {
            identifier: {
              system: "https://fhir.nhs.uk/Id/ods-organization-code",
              value: pharmacyOds
            }
          },
        },
        substitution: {allowedBoolean: false},
      },
    };

    requests.push(medRequest);
  }

  return requests;
}

function buildPatientEntry(
  nhsNumber: string,
  patientData: PatientData,
  practitionerOds: string,
  patientUuid: string
): any {
  return {
    fullUrl: `urn:uuid:${patientUuid}`,
    resource: {
      resourceType: "Patient",
      identifier: [{system: "https://fhir.nhs.uk/Id/nhs-number", value: nhsNumber}],
      name: [{
        use: "usual",
        family: patientData.family,
        given: patientData.given,
        prefix: [patientData.prefix],
      }],
      gender: patientData.gender,
      birthDate: patientData.birthDate,
      address: [{
        use: "home",
        line: patientData.address,
        postalCode: patientData.postalCode,
      }],
      generalPractitioner: [{
        identifier: {
          system: "https://fhir.nhs.uk/Id/ods-organization-code",
          value: practitionerOds
        }
      }],
    },
  };
}

function buildPractitionerRoleEntry(
  practitionerData: PractitionerData,
  practitionerUuid: string,
  practitionerRoleUuid: string,
  orgUuid: string
): any {
  return {
    fullUrl: `urn:uuid:${practitionerRoleUuid}`,
    resource: {
      resourceType: "PractitionerRole",
      identifier: [{
        system: "https://fhir.nhs.uk/Id/sds-role-profile-id",
        value: practitionerData.identifiers.sdsRoleId
      }],
      practitioner: {reference: `urn:uuid:${practitionerUuid}`},
      organization: {reference: `urn:uuid:${orgUuid}`},
      code: [{
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode",
            code: "R8000",
            display: "Clinical Practitioner Access Role"
          },
          {
            system: "https://fhir.hl7.org.uk/CodeSystem/UKCore-SDSJobRoleName",
            code: "R8000",
            display: "Clinical Practitioner Access Role"
          },
        ]
      }],
      telecom: [{system: "phone", use: "work", value: practitionerData.phone}],
    },
  };
}

function buildPractitionerEntry(
  practitionerData: PractitionerData,
  practitionerUuid: string
): any {
  const ids = practitionerData.identifiers;
  return {
    fullUrl: `urn:uuid:${practitionerUuid}`,
    resource: {
      resourceType: "Practitioner",
      identifier: [
        {system: "https://fhir.nhs.uk/Id/sds-user-id", value: ids.sdsUserId},
        {system: "https://fhir.hl7.org.uk/Id/gmc-number", value: ids.gmcNumber},
        {system: "https://fhir.hl7.org.uk/Id/din-number", value: ids.dinNumber},
      ],
      name: [{
        family: practitionerData.family,
        given: practitionerData.given,
        prefix: [practitionerData.prefix]
      }],
    },
  };
}

function buildOrganizationEntry(
  practitionerOds: string,
  orgUuid: string
): any {
  return {
    fullUrl: `urn:uuid:${orgUuid}`,
    resource: {
      resourceType: "Organization",
      identifier: [{
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: practitionerOds
      }],
      type: [{
        coding: [{
          system: "https://fhir.nhs.uk/CodeSystem/organisation-role",
          code: "76",
          display: "GP PRACTICE"
        }]
      }],
      name: GP_NAME,
      telecom: [{system: "phone", use: "work", value: "0115 9737320"}],
      address: [{
        use: "work",
        type: "both",
        line: [GP_NAME, "CHEAPSIDE"],
        city: "SHILDON",
        district: "COUNTY DURHAM",
        postalCode: "DL4 2HP",
      }],
      partOf: {
        identifier: {
          system: "https://fhir.nhs.uk/Id/ods-organization-code",
          value: "84H"
        },
        display: "NHS COUNTY DURHAM CCG"
      },
    },
  };
}

function buildHeaderEntry(
  practitionerOds: string,
  pharmacyOds: string,
  headerUuid: string,
  focusRefs: any[]
): any {
  return {
    fullUrl: `urn:uuid:${headerUuid}`,
    resource: {
      resourceType: "MessageHeader",
      eventCoding: {
        system: "https://fhir.nhs.uk/CodeSystem/message-event",
        code: "prescription-order",
        display: "Prescription Order"
      },
      destination: [{
        endpoint: PHARMACY_ENDPOINT,
        receiver: {
          identifier: {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: pharmacyOds
          },
          display: pharmacyOds
        }
      }],
      sender: {
        identifier: {
          system: "https://fhir.nhs.uk/Id/ods-organization-code",
          value: practitionerOds
        },
        display: GP_NAME
      },
      source: {
        endpoint: `https://directory.spineservices.nhs.uk/STU3/Organization/${practitionerOds}`
      },
      focus: focusRefs,
    },
  };
}

export interface CreatePrescriptionOptions {
  nhsNumber: string;
  count: number;
  pharmacyOds?: string;
  practitionerOds?: string;
}

export function createPrescriptionMessageBundle(options: CreatePrescriptionOptions): any {
  // Generate people and places
  const pharmacyOds = ensurePharmacyOds(options.pharmacyOds);
  const practitionerData = generatePractitionerData(options.practitionerOds);
  const patientData = generatePatientData();

  // Generate UUIDs and order numbers
  const ids = {
    bundle: randomUUID(),
    message: randomUUID(),
    header: randomUUID(),
    patient: randomUUID(),
    practitioner: randomUUID(),
    practitionerRole: randomUUID(),
    org: randomUUID(),
  };

  const groupOrderNumber = generatePrescriptionId(practitionerData.odsCode);
  const prescriptionId = randomUUID();

  // Build the medication requests
  const medRequests = buildMedicationRequests(
    options.count,
    ids.patient,
    ids.practitionerRole,
    pharmacyOds,
    groupOrderNumber,
    prescriptionId
  );

  const focusRefs = medRequests.map(req => ({reference: req.fullUrl}));

  const entries: any[] = [];

  const headerEntry = buildHeaderEntry(
    practitionerData.odsCode,
    pharmacyOds,
    ids.header,
    focusRefs
  );
  entries.push(headerEntry);

  entries.push(...medRequests);

  const patientEntry = buildPatientEntry(
    options.nhsNumber,
    patientData,
    practitionerData.odsCode,
    ids.patient
  );
  entries.push(patientEntry);

  const practitionerRoleEntry = buildPractitionerRoleEntry(
    practitionerData,
    ids.practitioner,
    ids.practitionerRole,
    ids.org
  );
  entries.push(practitionerRoleEntry);

  const practitionerEntry = buildPractitionerEntry(
    practitionerData,
    ids.practitioner
  );
  entries.push(practitionerEntry);

  const orgEntry = buildOrganizationEntry(
    practitionerData.odsCode,
    ids.org
  );
  entries.push(orgEntry);

  return {
    resourceType: "Bundle",
    id: ids.bundle,
    identifier: {
      system: "https://tools.ietf.org/html/rfc4122",
      value: ids.message
    },
    type: "message",
    entry: entries,
  };
}
