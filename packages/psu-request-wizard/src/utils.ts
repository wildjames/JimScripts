import {mkdirSync, writeFileSync} from "fs";
import {dirname} from "path";

const DEFAULT_ODS = "FA565";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord;
  }
  return undefined;
}

function asRecordArray(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asRecord(item))
    .filter((item): item is AnyRecord => item !== undefined);
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function pickIdentifierValue(value: unknown): string | undefined {
  const asRec = asRecord(value);
  if (asRec && typeof asRec.value === "string") {
    return asRec.value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const maybe = pickIdentifierValue(item);
      if (maybe) {
        return maybe;
      }
    }
  }

  return undefined;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function loadCollectionEntries(body: AnyRecord): AnyRecord[] {
  const entries = asRecordArray(body.entry);
  const collectionEntries: AnyRecord[] = [];

  for (const entry of entries) {
    const resource = asRecord(entry.resource);
    if (!resource) {
      continue;
    }

    if (resource.resourceType === "Bundle" && resource.type === "collection") {
      collectionEntries.push(...asRecordArray(resource.entry));
    }
  }

  return collectionEntries;
}

export function medicationRequestsFromPfp(body: AnyRecord): AnyRecord[] {
  const entries = loadCollectionEntries(body);
  const resources = entries
    .map((entry) => asRecord(entry.resource))
    .filter((resource): resource is AnyRecord => resource !== undefined);

  return resources.filter(
    (resource) => resource.resourceType === "MedicationRequest"
  );
}

export function findDispensePerformerOds(
  data: AnyRecord,
  medicationRequest: AnyRecord
): string {
  const dispenseRequest = asRecord(medicationRequest.dispenseRequest);
  const performer = asRecord(dispenseRequest?.performer);
  const performerRef = typeof performer?.reference === "string" ? performer.reference : "";
  const parts = performerRef ? performerRef.split(":") : [];
  const performerId = parts.length > 0 ? parts[parts.length - 1] : undefined;

  if (!performerId) {
    return DEFAULT_ODS;
  }

  const entries = loadCollectionEntries(data);
  for (const entry of entries) {
    const resource = asRecord(entry.resource);
    if (!resource || resource.resourceType !== "Organization") {
      continue;
    }

    if (resource.id !== performerId) {
      continue;
    }

    const identifierValue = pickIdentifierValue(resource.identifier);
    if (identifierValue) {
      return identifierValue;
    }
  }

  return DEFAULT_ODS;
}

export function extractMedicationSummary(medicationRequest: AnyRecord): {
  orderNumber: string;
  itemNumber: string;
  medicationName: string;
  status: string;
  npptStatus: string;
  nhsNumber: string;
} {
  const groupIdentifier = asRecord(medicationRequest.groupIdentifier);
  const medicationCodeableConcept = asRecord(medicationRequest.medicationCodeableConcept);
  const subject = asRecord(medicationRequest.subject);

  const coding = asRecordArray(medicationCodeableConcept?.coding);
  const medCode = coding[0];

  let npptStatus = "unknown";
  const extensions = asRecordArray(medicationRequest.extension);
  for (const extension of extensions) {
    const nested = asRecordArray(extension.extension);
    for (const ext of nested) {
      if (typeof ext.url === "string" && ext.url.toLowerCase() === "status") {
        const valueCoding = asRecord(ext.valueCoding);
        if (typeof valueCoding?.code === "string") {
          npptStatus = valueCoding.code;
        }
      }
    }
  }

  const orderNumber = firstString([groupIdentifier?.value]) ?? "";
  const itemNumber = pickIdentifierValue(medicationRequest.identifier) ?? "";
  const medicationName = firstString([medCode?.display]) ?? "Unknown medication";
  const status = firstString([medicationRequest.status]) ?? "unknown";
  const nhsNumber =
    firstString([
      pickIdentifierValue(subject?.identifier),
      pickIdentifierValue(asRecord(subject?.identifier)?.identifier)
    ]) ?? "";

  return {
    orderNumber,
    itemNumber,
    medicationName,
    status,
    npptStatus,
    nhsNumber
  };
}

export function outputBundle(
  bundle: Record<string, unknown>,
  toClipboard: boolean,
  outputPath?: string
): void {
  const serialized = JSON.stringify(bundle, null, 2);

  if (toClipboard) {
    console.error("Clipboard functionality not yet implemented.");
    console.log(serialized);
    return;
  }

  if (outputPath) {
    let destination = outputPath;
    if (destination.endsWith("/")) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      destination = `${destination}psu-bundle-${timestamp}.json`;
    }
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, serialized, "utf-8");
    console.log(destination);
    return;
  }

  console.log(serialized);
}
