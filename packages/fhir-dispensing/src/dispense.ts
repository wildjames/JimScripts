import {randomUUID} from "crypto";

import {generateOdsCode, generatePractitionerRole} from "data-generators";

import {sendDispensingRequest, type DispensingRequestResult} from "./http.js";

/**
 * Valid dispense notification type codes from medicationdispense-type CodeSystem.
 */
export const DISPENSE_TYPE_CODES: Record<string, string> = {
  "0001": "Item fully dispensed",
  "0002": "Item not dispensed",
  "0003": "Item dispensed - Loss on Arrival",
  "0004": "Item not dispensed owing",
  "0005": "Item cancelled",
  "0006": "Expired item",
  "0007": "Item to be dispensed",
  "0008": "Item with dispenser"
};

export interface DispenseNotificationOptions {
  prescriptionId: string;
  pharmacyOds?: string;
  reimbursementAuthority?: string;
  dispenseType?: string;
}

export interface DispenseRequestOptions {
  host: string;
  token: string;
  urid?: string;
  requestSaveDir?: string;
}

interface MedicationRequestResource {
  resourceType: "MedicationRequest";
  identifier?: Array<{system?: string; value?: string}>;
  status?: string;
  intent?: string;
  category?: Array<Record<string, unknown>>;
  medicationCodeableConcept?: Record<string, unknown>;
  subject?: Record<string, unknown>;
  requester?: Record<string, unknown>;
  groupIdentifier?: Record<string, unknown>;
  courseOfTherapyType?: Record<string, unknown>;
  dosageInstruction?: Array<Record<string, unknown>>;
  dispenseRequest?: {
    quantity?: {value?: number; unit?: string; system?: string; code?: string};
    performer?: {identifier?: {system?: string; value?: string}};
    extension?: Array<Record<string, unknown>>;
    validityPeriod?: Record<string, unknown>;
    [key: string]: unknown;
  };
  extension?: Array<Record<string, unknown>>;
  substitution?: Record<string, unknown>;
  [key: string]: unknown;
}

interface BundleEntry {
  fullUrl?: string;
  resource?: Record<string, unknown>;
}

interface PrescriptionBundle {
  resourceType: "Bundle";
  id?: string;
  identifier?: {system?: string; value?: string};
  type?: string;
  entry?: BundleEntry[];
  [key: string]: unknown;
}

function extractMedicationRequests(bundle: PrescriptionBundle): MedicationRequestResource[] {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e): e is BundleEntry & {resource: MedicationRequestResource} =>
      e.resource?.resourceType === "MedicationRequest"
    )
    .map(e => e.resource);
}

function extractPatientNhsNumber(bundle: PrescriptionBundle): string | undefined {
  const patientEntry = bundle.entry?.find(e => e.resource?.resourceType === "Patient");
  if (!patientEntry?.resource) return undefined;
  const patient = patientEntry.resource as Record<string, unknown>;
  const identifiers = patient.identifier as Array<{system?: string; value?: string}> | undefined;
  return identifiers?.find(
    id => id.system === "https://fhir.nhs.uk/Id/nhs-number"
  )?.value;
}

function extractPatientDisplay(bundle: PrescriptionBundle): string | undefined {
  const patientEntry = bundle.entry?.find(e => e.resource?.resourceType === "Patient");
  if (!patientEntry?.resource) return undefined;
  const patient = patientEntry.resource as Record<string, unknown>;
  const names = patient.name as Array<{prefix?: string[]; given?: string[]; family?: string}> | undefined;
  if (!names?.[0]) return undefined;
  const name = names[0];
  const parts: string[] = [];
  if (name.prefix?.[0]) parts.push(name.prefix[0]);
  if (name.given?.[0]) parts.push(name.given[0]);
  if (name.family) parts.push(name.family);
  return parts.join(" ") || undefined;
}

function extractBundleIdentifier(bundle: PrescriptionBundle): string {
  return bundle.identifier?.value ?? bundle.id ?? randomUUID();
}

function buildContainedPractitionerRole(organizationFullUrl: string): Record<string, unknown> {
  const practitionerRole = generatePractitionerRole({
    id: "performer",
    sdsJobRoleCode: "S0030:G0100:R0620"
  });

  return {
    ...practitionerRole,
    organization: {
      reference: organizationFullUrl
    }
  };
}

function resolveRequesterIdentifier(
  medRequest: MedicationRequestResource,
  bundle: PrescriptionBundle
): Record<string, unknown> {
  const requester = medRequest.requester as Record<string, unknown> | undefined;
  if (!requester) {
    return {identifier: {system: "https://fhir.nhs.uk/Id/sds-role-profile-id", value: "unknown"}};
  }

  // If already an identifier reference, use it directly
  if (requester.identifier) {
    return {identifier: requester.identifier};
  }

  // Resolve urn:uuid: reference to extract the SDS role profile ID
  const ref = requester.reference as string | undefined;
  if (ref && bundle.entry) {
    const entry = bundle.entry.find(e => e.fullUrl === ref);
    if (entry?.resource) {
      const resource = entry.resource as Record<string, unknown>;
      const identifiers = resource.identifier as Array<{system?: string; value?: string}> | undefined;
      const sdsId = identifiers?.find(
        id => id.system === "https://fhir.nhs.uk/Id/sds-role-profile-id"
      );
      if (sdsId) {
        return {identifier: {system: sdsId.system, value: sdsId.value}};
      }
    }
  }

  return requester;
}

function buildMedicationDispense(
  medRequest: MedicationRequestResource,
  nhsNumber: string | undefined,
  patientDisplay: string | undefined,
  dispenseType: string,
  medRequestFullUrl: string,
  organizationFullUrl: string
): Record<string, unknown> {
  const dispenseItemId = randomUUID();

  const quantity = medRequest.dispenseRequest?.quantity ?? {
    value: 1,
    unit: "unit",
    system: "http://snomed.info/sct",
    code: "732936001"
  };

  const dispenseTypeDisplay = DISPENSE_TYPE_CODES[dispenseType] ?? "Item fully dispensed";

  const subject: Record<string, unknown> = {
    type: "Patient",
    identifier: {
      system: "https://fhir.nhs.uk/Id/nhs-number",
      value: nhsNumber ?? "0000000000"
    }
  };
  if (patientDisplay) {
    subject.display = patientDisplay;
  }

  return {
    resourceType: "MedicationDispense",
    contained: [buildContainedPractitionerRole(organizationFullUrl)],
    extension: [
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-EPS-TaskBusinessStatus",
        valueCoding: {
          system: "https://fhir.nhs.uk/CodeSystem/EPS-task-business-status",
          code: "0003",
          display: "With Dispenser - Active"
        }
      }
    ],
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/prescription-dispense-item-number",
        value: dispenseItemId
      }
    ],
    status: "completed",
    medicationCodeableConcept: medRequest.medicationCodeableConcept,
    subject,
    performer: [
      {
        actor: {
          reference: "#performer"
        }
      }
    ],
    authorizingPrescription: [
      {
        reference: medRequestFullUrl
      }
    ],
    type: {
      coding: [
        {
          system: "https://fhir.nhs.uk/CodeSystem/medicationdispense-type",
          code: dispenseType,
          display: dispenseTypeDisplay
        }
      ]
    },
    quantity,
    whenHandedOver: new Date().toISOString(),
    dosageInstruction: medRequest.dosageInstruction ?? []
  };
}

function buildMedicationRequestForDispense(
  medRequest: MedicationRequestResource,
  nhsNumber: string | undefined,
  patientDisplay: string | undefined,
  dispenseType: string,
  inputBundle: PrescriptionBundle
): Record<string, unknown> {
  const dispenseTypeDisplay = DISPENSE_TYPE_CODES[dispenseType] ?? "Item fully dispensed";

  const extensions = [
    ...(medRequest.extension ?? []).filter(
      ext => ext.url !== "https://fhir.nhs.uk/StructureDefinition/Extension-EPS-DispensingInformation"
    ),
    {
      url: "https://fhir.nhs.uk/StructureDefinition/Extension-EPS-DispensingInformation",
      extension: [
        {
          url: "dispenseStatus",
          valueCoding: {
            system: "https://fhir.nhs.uk/CodeSystem/medicationdispense-type",
            code: dispenseType,
            display: dispenseTypeDisplay
          }
        }
      ]
    }
  ];

  const subject: Record<string, unknown> = {
    identifier: {
      system: "https://fhir.nhs.uk/Id/nhs-number",
      value: nhsNumber ?? "0000000000"
    }
  };
  if (patientDisplay) {
    subject.display = patientDisplay;
  }

  const orderItemId = medRequest.identifier?.find(
    id => id.system === "https://fhir.nhs.uk/Id/prescription-order-item-number"
  )?.value ?? randomUUID();

  return {
    resourceType: "MedicationRequest",
    id: `m-${orderItemId.slice(0, 8)}`,
    extension: extensions,
    identifier: medRequest.identifier,
    status: medRequest.status ?? "active",
    intent: medRequest.intent ?? "order",
    category: medRequest.category,
    medicationCodeableConcept: medRequest.medicationCodeableConcept,
    subject,
    requester: resolveRequesterIdentifier(medRequest, inputBundle),
    groupIdentifier: medRequest.groupIdentifier,
    courseOfTherapyType: medRequest.courseOfTherapyType,
    dosageInstruction: medRequest.dosageInstruction,
    dispenseRequest: medRequest.dispenseRequest,
    substitution: medRequest.substitution
  };
}

function buildOrganization(
  pharmacyOds: string,
  reimbursementAuthority?: string
): Record<string, unknown> {
  const extensions: Array<Record<string, unknown>> = [];

  if (reimbursementAuthority) {
    extensions.push({
      url: "https://fhir.nhs.uk/StructureDefinition/Extension-ODS-OrganisationRelationships",
      extension: [
        {
          url: "reimbursementAuthority",
          valueIdentifier: {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: reimbursementAuthority
          }
        }
      ]
    });
  }

  const org: Record<string, unknown> = {
    resourceType: "Organization",
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: pharmacyOds
      }
    ],
    active: true,
    type: [
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/organisation-role",
            code: "182",
            display: "PHARMACY"
          }
        ]
      }
    ]
  };

  if (extensions.length > 0) {
    org.extension = extensions;
  }

  return org;
}

export function generateDispenseNotificationBundle(
  inputBundle: PrescriptionBundle,
  options: DispenseNotificationOptions
): Record<string, unknown> {
  const medicationRequests = extractMedicationRequests(inputBundle);

  if (medicationRequests.length === 0) {
    throw new Error("Input bundle contains no MedicationRequest resources");
  }

  const nhsNumber = extractPatientNhsNumber(inputBundle);
  const patientDisplay = extractPatientDisplay(inputBundle);
  const pharmacyOds = options.pharmacyOds ?? generateOdsCode(5);
  const dispenseType = options.dispenseType ?? "0001";
  const bundleId = randomUUID();
  const messageHeaderId = randomUUID();
  const organizationId = randomUUID();

  const organizationFullUrl = `urn:uuid:${organizationId}`;

  // Build paired MedicationRequest + MedicationDispense entries.
  // The MedicationDispense.authorizingPrescription must reference the
  // MedicationRequest entry's fullUrl within this bundle.
  const pairedEntries = medicationRequests.map(mr => {
    const mrId = randomUUID();
    const mrFullUrl = `urn:uuid:${mrId}`;

    const medRequestResource = buildMedicationRequestForDispense(
      mr, nhsNumber, patientDisplay, dispenseType, inputBundle
    );

    const dispenseResource = buildMedicationDispense(
      mr, nhsNumber, patientDisplay, dispenseType, mrFullUrl, organizationFullUrl
    );
    const dispenseId = randomUUID();
    const dispenseFullUrl = `urn:uuid:${dispenseId}`;

    return {
      medRequest: {fullUrl: mrFullUrl, resource: medRequestResource},
      dispense: {fullUrl: dispenseFullUrl, resource: dispenseResource}
    };
  });

  const dispenseEntries = pairedEntries.map(p => p.dispense);
  const medRequestEntries = pairedEntries.map(p => p.medRequest);

  // Build Organization entry
  const orgEntry = {
    fullUrl: organizationFullUrl,
    resource: buildOrganization(pharmacyOds, options.reimbursementAuthority)
  };

  // Build MessageHeader
  const messageHeader: Record<string, unknown> = {
    resourceType: "MessageHeader",
    eventCoding: {
      system: "https://fhir.nhs.uk/CodeSystem/message-event",
      code: "dispense-notification",
      display: "Dispense Notification"
    },
    sender: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: pharmacyOds
      },
      display: pharmacyOds
    },
    source: {
      endpoint: `https://directory.spineservices.nhs.uk/STU3/Organization/${pharmacyOds}`
    },
    reason: {
      coding: [
        {
          system: "https://fhir.nhs.uk/CodeSystem/message-reason-prescription",
          code: "notification",
          display: "Notification"
        }
      ]
    },
    response: {
      identifier: extractBundleIdentifier(inputBundle),
      code: "ok"
    },
    focus: dispenseEntries.map(e => ({reference: e.fullUrl}))
  };

  // Assemble the bundle
  const entries: Array<{fullUrl: string; resource: Record<string, unknown>}> = [
    {
      fullUrl: `urn:uuid:${messageHeaderId}`,
      resource: messageHeader
    },
    ...dispenseEntries.map(e => ({fullUrl: e.fullUrl, resource: e.resource})),
    ...medRequestEntries,
    orgEntry
  ];

  return {
    resourceType: "Bundle",
    id: bundleId,
    identifier: {
      system: "https://tools.ietf.org/html/rfc4122",
      value: bundleId
    },
    type: "message",
    timestamp: new Date().toISOString(),
    entry: entries
  };
}

export async function dispenseNotification(
  inputBundle: PrescriptionBundle,
  dispenseOptions: DispenseNotificationOptions,
  requestOptions: DispenseRequestOptions
): Promise<DispensingRequestResult> {
  const body = generateDispenseNotificationBundle(inputBundle, dispenseOptions);

  console.log(`Sending dispense notification for prescription ${dispenseOptions.prescriptionId}`);

  return sendDispensingRequest({
    host: requestOptions.host,
    token: requestOptions.token,
    endpoint: "$process-message#dispense-notification",
    body,
    urid: requestOptions.urid,
    requestSaveDir: requestOptions.requestSaveDir,
    requestFilePrefix: "dispense-request"
  });
}
