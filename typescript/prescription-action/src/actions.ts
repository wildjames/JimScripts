import {randomUUID} from "crypto";

export const SUPPORTED_ACTIONS = [
  "cancel",
  "claim",
  "release",
  "dispense"
] as const;

export type PrescriptionAction = (typeof SUPPORTED_ACTIONS)[number];

export interface BundleLike {
  resourceType?: string;
  id?: string;
  identifier?: {
    system?: string;
    value?: string;
  };
  type?: string;
  entry?: Array<{
    fullUrl?: string;
    resource?: {
      resourceType?: string;
      eventCoding?: {
        system?: string;
        code?: string;
        display?: string;
      };
      focus?: unknown[];
      status?: string;
      statusReason?: unknown;
      [key: string]: unknown;
    };
  }>;
  [key: string]: unknown;
}

export interface CreatePrescriptionActionOptions {
  action: PrescriptionAction;
  inputBundle: BundleLike;
}

function cloneBundle(bundle: BundleLike): BundleLike {
  return JSON.parse(JSON.stringify(bundle)) as BundleLike;
}

function updateMessageHeaderForCancellation(bundle: BundleLike): void {
  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;

    if (resource?.resourceType === "MessageHeader") {
      resource.eventCoding = {
        system: "https://fhir.nhs.uk/CodeSystem/message-event",
        code: "prescription-order-update",
        display: "Prescription Order Update"
      };
      resource.focus = [];
    }
  }
}

function updateMedicationRequestsForCancellation(bundle: BundleLike): void {
  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;

    if (resource?.resourceType === "MedicationRequest") {
      resource.status = "cancelled";
      resource.statusReason = {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/medicationrequest-status-reason",
            code: "0001",
            display: "Prescribing Error"
          }
        ]
      };
    }
  }
}

function createCancellationBundle(inputBundle: BundleLike): BundleLike {
  if (inputBundle.resourceType !== "Bundle") {
    throw new Error("Input must be a FHIR Bundle.");
  }

  const output = cloneBundle(inputBundle);

  output.identifier = {
    system: "https://tools.ietf.org/html/rfc4122",
    value: randomUUID()
  };

  updateMessageHeaderForCancellation(output);
  updateMedicationRequestsForCancellation(output);

  return output;
}

export function createPrescriptionActionBundle(
  options: CreatePrescriptionActionOptions
): BundleLike {
  if (options.action !== "cancel") {
    throw new Error(
      `Action '${options.action}' is not yet supported. Implemented actions: cancel`
    );
  }

  return createCancellationBundle(options.inputBundle);
}
