import { randomUUID } from "crypto";

import { generateOdsCode, generatePractitionerRole } from "data-generators";

import { sendDispensingRequest, type DispensingRequestResult } from "./http.js";

/**
 * Valid prescription charge exemption codes.
 */
export const CHARGE_EXEMPTION_CODES: Record<string, string> = {
  "0001": "Patient has paid appropriate charges",
  "0002": "is under 16 years of age",
  "0003": "is 16, 17 or 18 and in full-time education",
  "0004": "is 60 years of age or over",
  "0005": "has a valid maternity exemption certificate",
  "0006": "has a valid medical exemption certificate",
  "0007": "has a valid prescription pre-payment certificate",
  "0008": "has a valid War Pension exemption certificate",
  "0009": "is named on a current HC2 charges certificate",
  "0010": "was prescribed free-of-charge contraceptives",
  "0011": "gets income support (IS)",
  "0012": "gets income based Job Seeker's Allowance (JSA (IB))",
  "0013":
    "is entitled to, or named on a valid NHS tax credit exemption certificate",
  "0014":
    "has a valid NHS prescription exemption certificate (NHS Business Services Authority Scotland)",
  "0015": "gets Pension Credit guarantee credit (PCGC)",
};

/**
 * Valid EPS-task-business-status codes for claims.
 */
export const CLAIM_STATUS_CODES: Record<string, string> = {
  "0004": "Cancelled",
  "0005": "Expired",
  "0006": "Dispensed",
  "0007": "Not Dispensed",
};

/**
 * Valid exemption evidence codes.
 */
export const EXEMPTION_EVIDENCE_CODES: Record<string, string> = {
  "evidence-seen": "Evidence Seen",
  "no-evidence-seen": "No Evidence Seen",
};

export interface ClaimOptions {
  prescriptionId: string;
  pharmacyOds?: string;
  chargeExemption?: string;
  exemptionEvidence?: string;
  dispenseType?: string;
  endorsementCode?: string;
  claimStatus?: string;
}

export interface ClaimRequestOptions {
  host: string;
  token: string;
  urid?: string;
  requestSaveDir?: string;
  requestId?: string;
  correlationId?: string;
}

interface MedicationDispenseResource {
  resourceType: "MedicationDispense";
  identifier?: Array<{ system?: string; value?: string }>;
  medicationCodeableConcept?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  subject?: Record<string, unknown>;
  quantity?: { value?: number; unit?: string; system?: string; code?: string };
  contained?: Array<Record<string, unknown>>;
  authorizingPrescription?: Array<{ reference?: string }>;
  [key: string]: unknown;
}

interface DispenseNotificationBundle {
  resourceType: "Bundle";
  entry?: Array<{
    fullUrl?: string;
    resource?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

function extractMedicationDispenses(
  bundle: DispenseNotificationBundle,
): MedicationDispenseResource[] {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource?.resourceType === "MedicationDispense")
    .map((e) => e.resource as MedicationDispenseResource);
}

function extractContainedMedicationRequest(
  dispense: MedicationDispenseResource,
): Record<string, unknown> | undefined {
  if (!dispense.contained) return undefined;
  return dispense.contained.find(
    (r) => (r as Record<string, unknown>).resourceType === "MedicationRequest",
  ) as Record<string, unknown> | undefined;
}

function extractPatientNhsNumber(
  bundle: DispenseNotificationBundle,
): string | undefined {
  const dispenses = extractMedicationDispenses(bundle);
  for (const d of dispenses) {
    const subject = d.subject as Record<string, unknown> | undefined;
    if (!subject) continue;
    const identifier = subject.identifier as
      | { system?: string; value?: string }
      | undefined;
    if (
      identifier?.system === "https://fhir.nhs.uk/Id/nhs-number" &&
      identifier?.value
    ) {
      return identifier.value;
    }
  }
  return undefined;
}

function extractPatientDisplay(
  bundle: DispenseNotificationBundle,
): string | undefined {
  const dispenses = extractMedicationDispenses(bundle);
  for (const d of dispenses) {
    const subject = d.subject as Record<string, unknown> | undefined;
    if (subject?.display) return subject.display as string;
  }
  return undefined;
}

function extractPrescriptionIdentifiers(
  bundle: DispenseNotificationBundle,
): { shortForm: string; uuid: string } | undefined {
  const dispenses = extractMedicationDispenses(bundle);
  for (const d of dispenses) {
    const medRequest = extractContainedMedicationRequest(d);
    if (!medRequest) continue;

    const groupId = medRequest.groupIdentifier as
      | Record<string, unknown>
      | undefined;
    if (!groupId) continue;

    const shortForm = groupId.value as string | undefined;
    const extensions = groupId.extension as
      | Array<Record<string, unknown>>
      | undefined;
    const uuidExt = extensions?.find(
      (ext) =>
        ext.url ===
        "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionId",
    );
    const uuid = (
      uuidExt?.valueIdentifier as Record<string, unknown> | undefined
    )?.value as string | undefined;

    if (shortForm && uuid) {
      return { shortForm, uuid };
    }
  }
  return undefined;
}

function extractOrganization(
  bundle: DispenseNotificationBundle,
): Record<string, unknown> | undefined {
  if (!bundle.entry) return undefined;
  const orgEntry = bundle.entry.find(
    (e) => e.resource?.resourceType === "Organization",
  );
  return orgEntry?.resource as Record<string, unknown> | undefined;
}

function buildContainedResources(
  pharmacyOds: string,
  existingOrg?: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const practitionerRole = generatePractitionerRole({
    id: "provider",
    sdsJobRoleCode: "S0030:G0100:R0620",
  });

  const providerPR = {
    ...practitionerRole,
    organization: { reference: "#organisation" },
  };

  let org: Record<string, unknown>;
  if (existingOrg) {
    org = { ...existingOrg, id: "organisation" };
  } else {
    org = {
      resourceType: "Organization",
      id: "organisation",
      identifier: [
        {
          system: "https://fhir.nhs.uk/Id/ods-organization-code",
          value: pharmacyOds,
        },
      ],
      address: [
        {
          use: "work",
          line: ["17 Austhorpe Road", "Crossgates", "Leeds"],
          city: "West Yorkshire",
          postalCode: "LS15 8BA",
        },
      ],
      active: true,
      type: [
        {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/organisation-role",
              code: "182",
              display: "PHARMACY",
            },
          ],
        },
      ],
      name: "The Simple Pharmacy",
      telecom: [{ system: "phone", use: "work", value: "0113 3180277" }],
    };
  }

  return [providerPR, org];
}

function buildClaimDetail(
  dispense: MedicationDispenseResource,
  sequence: number,
  dispenseType: string,
): Record<string, unknown> {
  const medRequest = extractContainedMedicationRequest(dispense);

  // Get order item number from the contained MedicationRequest
  const mrIdentifiers = (medRequest?.identifier ?? []) as Array<{
    system?: string;
    value?: string;
  }>;
  const orderItemNumber =
    mrIdentifiers.find(
      (id) =>
        id.system === "https://fhir.nhs.uk/Id/prescription-order-item-number",
    )?.value ?? randomUUID();

  // Get dispense item number
  const dispenseItemNumber =
    dispense.identifier?.find(
      (id) =>
        id.system ===
        "https://fhir.nhs.uk/Id/prescription-dispense-item-number",
    )?.value ?? randomUUID();

  const dispenseTypeDisplay =
    {
      "0001": "Item fully dispensed",
      "0002": "Item not dispensed",
      "0003": "Item dispensed - partial",
      "0004": "Item not dispensed owing",
      "0005": "Item cancelled",
    }[dispenseType] ?? "Item fully dispensed";

  const medication = dispense.medicationCodeableConcept ?? {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "16076005",
        display: "Prescription",
      },
    ],
  };

  const quantity = dispense.quantity ?? {
    value: 1,
    unit: "unit",
    system: "http://snomed.info/sct",
    code: "732936001",
  };

  return {
    extension: [
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-ClaimSequenceIdentifier",
        valueIdentifier: {
          system: "https://fhir.nhs.uk/Id/claim-sequence-identifier",
          value: randomUUID(),
        },
      },
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-ClaimMedicationRequestReference",
        valueReference: {
          identifier: {
            system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
            value: orderItemNumber,
          },
        },
      },
    ],
    sequence,
    productOrService: medication,
    modifier: [
      {
        coding: [
          {
            code: dispenseType,
            system: "https://fhir.nhs.uk/CodeSystem/medicationdispense-type",
            display: dispenseTypeDisplay,
          },
        ],
      },
    ],
    programCode: [
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/DM-prescription-charge",
            code: "paid-once",
            display: "Paid Once",
          },
        ],
      },
      {
        coding: [
          {
            system:
              "https://fhir.nhs.uk/CodeSystem/medicationdispense-endorsement",
            code: "NDEC",
            display: "No Dispenser Endorsement Code",
          },
        ],
      },
    ],
    quantity,
    subDetail: [
      {
        extension: [
          {
            url: "https://fhir.nhs.uk/StructureDefinition/Extension-ClaimMedicationDispenseReference",
            valueReference: {
              identifier: {
                system:
                  "https://fhir.nhs.uk/Id/prescription-dispense-item-number",
                value: dispenseItemNumber,
              },
            },
          },
        ],
        sequence: 1,
        productOrService: medication,
        quantity,
      },
    ],
  };
}

export function generateClaim(
  inputBundle: DispenseNotificationBundle,
  options: ClaimOptions,
): Record<string, unknown> {
  const dispenses = extractMedicationDispenses(inputBundle);

  if (dispenses.length === 0) {
    throw new Error("Input bundle contains no MedicationDispense resources");
  }

  const nhsNumber = extractPatientNhsNumber(inputBundle) ?? "0000000000";
  const patientDisplay = extractPatientDisplay(inputBundle);
  const prescriptionIds = extractPrescriptionIdentifiers(inputBundle);
  const existingOrg = extractOrganization(inputBundle);
  const pharmacyOds =
    options.pharmacyOds ??
    extractPharmacyOds(existingOrg) ??
    generateOdsCode(5);
  const dispenseType = options.dispenseType ?? "0001";
  const claimStatus = options.claimStatus ?? "0006";
  const chargeExemption = options.chargeExemption ?? "0001";
  const exemptionEvidence = options.exemptionEvidence ?? "no-evidence-seen";

  const claimId = randomUUID();
  const containedResources = buildContainedResources(pharmacyOds, existingOrg);

  // Build the detail array - one per MedicationDispense
  const details = dispenses.map((d, i) =>
    buildClaimDetail(d, i + 1, dispenseType),
  );

  const claimStatusDisplay = CLAIM_STATUS_CODES[claimStatus] ?? "Dispensed";

  const chargeExemptionDisplay =
    CHARGE_EXEMPTION_CODES[chargeExemption] ??
    "Patient has paid appropriate charges";
  const exemptionEvidenceDisplay =
    EXEMPTION_EVIDENCE_CODES[exemptionEvidence] ?? "No Evidence Seen";

  // Build provenance agent extension
  const practitioner = containedResources[0]?.practitioner as
    | Record<string, unknown>
    | undefined;
  const practitionerIdentifier = (
    practitioner as Record<string, unknown> | undefined
  )?.identifier as Record<string, unknown> | undefined;
  const practitionerDisplay = (
    practitioner as Record<string, unknown> | undefined
  )?.display as string | undefined;

  const provenanceExtension: Record<string, unknown> = {
    url: "https://fhir.nhs.uk/StructureDefinition/Extension-Provenance-agent",
    valueReference: {
      identifier: practitionerIdentifier ?? {
        system: "https://fhir.nhs.uk/Id/sds-user-id",
        value: "7654321",
      },
      display: practitionerDisplay ?? "Unknown Practitioner",
    },
  };

  // Build prescription reference
  const prescriptionRef: Record<string, unknown> = {
    extension: [
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-GroupIdentifier",
        extension: [
          {
            url: "shortForm",
            valueIdentifier: {
              system: "https://fhir.nhs.uk/Id/prescription-order-number",
              value: prescriptionIds?.shortForm ?? options.prescriptionId,
            },
          },
          {
            url: "UUID",
            valueIdentifier: {
              system: "https://fhir.nhs.uk/Id/prescription",
              value: prescriptionIds?.uuid ?? randomUUID(),
            },
          },
        ],
      },
    ],
    display: "A prescription order",
  };

  // Build the item array
  const item: Record<string, unknown> = {
    extension: [
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-EPS-TaskBusinessStatus",
        valueCoding: {
          code: claimStatus,
          system: "https://fhir.nhs.uk/CodeSystem/EPS-task-business-status",
          display: claimStatusDisplay,
        },
      },
    ],
    sequence: 1,
    productOrService: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "16076005",
          display: "Prescription",
        },
      ],
    },
    programCode: [
      {
        coding: [
          {
            code: chargeExemption,
            system:
              "https://fhir.nhs.uk/CodeSystem/prescription-charge-exemption",
            display: chargeExemptionDisplay,
          },
        ],
      },
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/DM-exemption-evidence",
            code: exemptionEvidence,
            display: exemptionEvidenceDisplay,
          },
        ],
      },
    ],
    detail: details,
  };

  const patient: Record<string, unknown> = {
    identifier: {
      system: "https://fhir.nhs.uk/Id/nhs-number",
      value: nhsNumber,
    },
  };
  if (patientDisplay) {
    (patient as Record<string, unknown>).display = patientDisplay;
  }

  return {
    resourceType: "Claim",
    id: claimId,
    extension: [provenanceExtension],
    contained: containedResources,
    created: new Date().toISOString(),
    identifier: [
      {
        system: "https://tools.ietf.org/html/rfc4122",
        value: randomUUID(),
      },
    ],
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "pharmacy",
          display: "Pharmacy",
        },
      ],
    },
    use: "claim",
    patient,
    provider: { reference: "#provider" },
    priority: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/processpriority",
          code: "normal",
        },
      ],
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          identifier: {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: "T1450",
          },
          display: "NHS BUSINESS SERVICES AUTHORITY",
        },
      },
    ],
    payee: {
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/payeetype",
            code: "provider",
            display: "Provider",
          },
        ],
      },
      party: { reference: "#organisation" },
    },
    prescription: prescriptionRef,
    item: [item],
  };
}

function extractPharmacyOds(
  org: Record<string, unknown> | undefined,
): string | undefined {
  if (!org) return undefined;
  const identifiers = org.identifier as
    | Array<{ system?: string; value?: string }>
    | undefined;
  return identifiers?.find(
    (id) => id.system === "https://fhir.nhs.uk/Id/ods-organization-code",
  )?.value;
}

export async function submitClaim(
  inputBundle: DispenseNotificationBundle,
  claimOptions: ClaimOptions,
  requestOptions: ClaimRequestOptions,
): Promise<DispensingRequestResult> {
  const body = generateClaim(inputBundle, claimOptions);

  console.log(
    `Submitting claim for prescription ${claimOptions.prescriptionId}`,
  );

  return sendDispensingRequest({
    host: requestOptions.host,
    token: requestOptions.token,
    endpoint: "Claim",
    body,
    urid: requestOptions.urid,
    requestSaveDir: requestOptions.requestSaveDir,
    action: "claim",
    requestId: requestOptions.requestId,
    correlationId: requestOptions.correlationId,
  });
}
