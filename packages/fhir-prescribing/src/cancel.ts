import {randomUUID} from "crypto";
import {cloneBundle} from "./utils.js";
import {sendFhirRequest} from "./http.js";
import type {BundleLike, SubmitCancellationOptions, SubmitCancellationResult} from "./types.js";

// https://digital.nhs.uk/developer/api-catalogue/eps-fhir-prescribing-api#post-/FHIR/R4/$process-message-prescription-order-update

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

export interface CancellationOptions {
  // If not given, it defaults to "0001" (Prescribing Error)
  reasonCode?: string;
  // If not given, then it uses the default display based on the reason code
  reasonDisplay?: string;
}

export const CANCELLATION_REASON_TYPES = [
  "0001",
  "0002",
  "0003",
  "0004"
] as const;

export type CancellationReasonType = (typeof CANCELLATION_REASON_TYPES)[number];

const CANCELLATION_REASON_DISPLAY_BY_TYPE: Record<CancellationReasonType, string> = {
  "0001": "Prescribing Error",
  "0002": "Clinical Grounds",
  "0003": "Patient Request",
  "0004": "At the Discretion of the Pharmacy"
};

export function parseCancellationReasonType(value?: string): CancellationReasonType {
  if (!value || value.trim() === "") {
    return "0001";
  }

  const normalizedValue = value.trim() as CancellationReasonType;
  if (CANCELLATION_REASON_TYPES.includes(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Unknown cancellation reason type '${value}'. Allowed values: ${CANCELLATION_REASON_TYPES.join(", ")}`
  );
}

function updateMedicationRequestsForCancellation(
  bundle: BundleLike,
  reasonCode: string,
  reasonDisplay: string
): void {
  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;

    if (resource?.resourceType === "MedicationRequest") {
      resource.status = "cancelled";
      resource.statusReason = {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/medicationrequest-status-reason",
            code: reasonCode,
            display: reasonDisplay
          }
        ]
      };
    }
  }
}

export function createCancellationBundle(
  inputBundle: BundleLike,
  options?: CancellationOptions
): BundleLike {
  if (inputBundle.resourceType !== "Bundle") {
    throw new Error("Input must be a FHIR Bundle.");
  }

  const output = cloneBundle(inputBundle);

  output.identifier = {
    system: "https://tools.ietf.org/html/rfc4122",
    value: randomUUID()
  };

  const reasonType = parseCancellationReasonType(options?.reasonCode);
  const reasonCode = reasonType;
  const reasonDisplay = options?.reasonDisplay ?? CANCELLATION_REASON_DISPLAY_BY_TYPE[reasonType];

  updateMessageHeaderForCancellation(output);
  updateMedicationRequestsForCancellation(output, reasonCode, reasonDisplay);

  return output;
}

export async function createAndSubmitCancellation(
  options: SubmitCancellationOptions
): Promise<SubmitCancellationResult> {
  const {host, token, bundle, urid, cancellationReasonType} = options;
  const cancellationBundle = createCancellationBundle(bundle, {
    reasonCode: cancellationReasonType
  });

  const {response, requestId, correlationId} = await sendFhirRequest({
    host,
    path: "/fhir-prescribing/FHIR/R4/$process-message",
    token,
    body: cancellationBundle,
    urid
  });

  const bodyText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  return {
    response: {
      status: response.status,
      statusText: response.statusText,
      body
    },
    cancellationBundle,
    requestId,
    correlationId
  };
}
