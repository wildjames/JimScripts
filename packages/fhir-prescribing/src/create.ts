import {sendFhirRequest} from "./http.js";
import {preparePrescription} from "./prepare.js";
import {addProvenanceToBundle} from "./provenance.js";
import {signDigest} from "./signing.js";
import type {
  CreatePrescriptionFlowOptions,
  CreatePrescriptionUserRestrictedOptions,
  CreatePrescriptionResult
} from "./types.js";

// https://digital.nhs.uk/developer/api-catalogue/eps-fhir-prescribing-api#post-/FHIR/R4/$process-message-prescription-order

export async function createAndSubmitPrescription(
  options: CreatePrescriptionUserRestrictedOptions
): Promise<CreatePrescriptionResult> {
  return submitPrescriptionWithToken(options);
}

async function submitPrescriptionWithToken(
  options: CreatePrescriptionUserRestrictedOptions
): Promise<CreatePrescriptionResult> {
  const {host, token, privateKey, bundle, urid, algorithm} = options;

  const {digest, timestamp} = await preparePrescription(host, token, bundle, urid);
  const signature = signDigest(digest, privateKey, algorithm);

  const signedBundle = addProvenanceToBundle(bundle, digest, signature, timestamp);

  const {response, requestId, correlationId} = await sendFhirRequest({
    host,
    path: "/fhir-prescribing/FHIR/R4/$process-message",
    token,
    body: signedBundle,
    urid
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `$process-message failed: ${response.status} ${response.statusText} ${errorBody}`
    );
  }

  const bodyText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  return {
    digest,
    signature,
    timestamp,
    signedBundle,
    response: {
      status: response.status,
      statusText: response.statusText,
      body
    },
    requestId,
    correlationId
  };
}
