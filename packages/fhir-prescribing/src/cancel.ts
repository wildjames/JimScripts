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
  reasonCode?: string;
  reasonDisplay?: string;
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

  const reasonCode = options?.reasonCode ?? "0001";
  const reasonDisplay = options?.reasonDisplay ?? "Prescribing Error";

  updateMessageHeaderForCancellation(output);
  updateMedicationRequestsForCancellation(output, reasonCode, reasonDisplay);

  return output;
}

export async function createAndSubmitCancellation(
  options: SubmitCancellationOptions
): Promise<SubmitCancellationResult> {
  const {host, token, bundle, urid} = options;
  const cancellationBundle = createCancellationBundle(bundle);

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
