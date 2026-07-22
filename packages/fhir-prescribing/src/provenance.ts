import { randomUUID } from "crypto";
import { cloneBundle } from "./utils.js";
import type { BundleLike } from "./types.js";

export function addProvenanceToBundle(
  bundle: BundleLike,
  digest: string,
  signature: string,
  timestamp: string,
  certificate?: string,
): BundleLike {
  const output = cloneBundle(bundle);

  // digest is the base64-encoded <SignedInfo> XML from $prepare.
  // Strip the xmlns attribute from <SignedInfo> per NHS guidance Step 3:
  // "decoded signed info block with the xmlns attribute removed"
  const decodedSignedInfo = Buffer.from(digest, "base64").toString("utf-8");
  const signedInfoClean = decodedSignedInfo.replace(
    /<SignedInfo xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/,
    "<SignedInfo>",
  );

  // Extract certificate body (strip PEM headers/whitespace) if provided
  const certBody = certificate
    ? certificate
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s/g, "")
    : "";

  // Build the Signature XML matching the NHS example format
  const signatureXml = Buffer.from(
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfoClean +
      `<SignatureValue>${signature}</SignatureValue>` +
      `<KeyInfo><X509Data><X509Certificate>${certBody}</X509Certificate></X509Data></KeyInfo>` +
      `</Signature>`,
  ).toString("base64");

  const medicationRequestRefs = (output.entry ?? [])
    .filter((e) => e.resource?.resourceType === "MedicationRequest")
    .map((e) => ({ reference: e.fullUrl }));

  const practitionerRoleEntry = (output.entry ?? []).find(
    (e) => e.resource?.resourceType === "PractitionerRole",
  );

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
            reference: practitionerRoleEntry?.fullUrl ?? "unknown",
          },
        },
      ],
      signature: [
        {
          type: [
            {
              system: "urn:iso-astm:E1762-95:2013",
              code: "1.2.840.10065.1.12.1.1",
            },
          ],
          when: timestamp,
          who: {
            reference: practitionerRoleEntry?.fullUrl ?? "unknown",
          },
          data: signatureXml,
        },
      ],
    },
  };

  output.entry = [...(output.entry ?? []), provenanceEntry];

  const messageHeader = (output.entry ?? []).find(
    (e) => e.resource?.resourceType === "MessageHeader",
  );
  if (
    messageHeader?.resource?.focus &&
    Array.isArray(messageHeader.resource.focus)
  ) {
    (messageHeader.resource.focus as Array<{ reference: string }>).push({
      reference: provenanceId,
    });
  }

  return output;
}
