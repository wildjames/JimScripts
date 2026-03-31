import {randomUUID} from "crypto";
import {cloneBundle} from "./utils.js";
import type {BundleLike} from "./types.js";

export function addProvenanceToBundle(
  bundle: BundleLike,
  digest: string,
  signature: string,
  timestamp: string
): BundleLike {
  const output = cloneBundle(bundle);

  const signatureXml = Buffer.from(
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<SignedInfo><DigestValue>${digest}</DigestValue></SignedInfo>` +
    `<SignatureValue>${signature}</SignatureValue>` +
    `</Signature>`
  ).toString("base64");

  const medicationRequestRefs = (output.entry ?? [])
    .filter(e => e.resource?.resourceType === "MedicationRequest")
    .map(e => ({reference: e.fullUrl}));

  const practitionerRoleEntry = (output.entry ?? [])
    .find(e => e.resource?.resourceType === "PractitionerRole");

  const provenanceId = `urn:uuid:${randomUUID()}`;

  const provenanceEntry = {
    fullUrl: provenanceId,
    resource: {
      resourceType: "Provenance",
      id: provenanceId,
      target: medicationRequestRefs,
      recorded: timestamp,
      agent: [
        {
          who: {
            reference: practitionerRoleEntry?.fullUrl ?? "unknown"
          }
        }
      ],
      signature: [
        {
          type: [
            {
              system: "urn:iso-astm:E1762-95:2013",
              code: "1.2.840.10065.1.12.1.1"
            }
          ],
          when: timestamp,
          who: {
            reference: practitionerRoleEntry?.fullUrl ?? "unknown"
          },
          data: signatureXml
        }
      ]
    }
  };

  output.entry = [...(output.entry ?? []), provenanceEntry];

  const messageHeader = (output.entry ?? []).find(
    e => e.resource?.resourceType === "MessageHeader"
  );
  if (messageHeader?.resource?.focus && Array.isArray(messageHeader.resource.focus)) {
    (messageHeader.resource.focus as Array<{reference: string}>).push({
      reference: provenanceId
    });
  }

  return output;
}
