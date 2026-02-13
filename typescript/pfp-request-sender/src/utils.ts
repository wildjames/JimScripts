import {mkdirSync, readFileSync, writeFileSync} from "fs";
import {dirname} from "path";

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }
  return value;
}

export function outputBundle(
  bundle: Record<string, unknown>,
  toClipboard: boolean,
  outputPath?: string
): void {
  const serialized = JSON.stringify(bundle, null, 2);

  if (toClipboard) {
    throw new Error("Clipboard output is not implemented.");
  }

  if (outputPath) {
    const directory = dirname(outputPath);
    saveBundle("psu-bundle", bundle, directory, findNhsNumber(bundle));
    return;
  }

  console.log(serialized);
}

export function saveBundle(
  prefix: string,
  bundle: Record<string, unknown>,
  saveDir: string,
  nhsNumber?: string
): void {
  mkdirSync(saveDir, {recursive: true});

  const number = nhsNumber ?? "unknown-nhs-number";
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");

  const filePath = `${saveDir}/${prefix}_${ts}_nhs-num-${number}.json`;
  writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
  console.log(filePath);
}

function findNhsNumber(bundle: Record<string, unknown>): string {
  const entries = Array.isArray((bundle as {entry?: unknown}).entry)
    ? ((bundle as {entry: unknown[]}).entry as Record<string, unknown>[])
    : [];

  const resources = collectResources(entries);
  const order = [
    {
      type: "MedicationRequest",
      extractor: (resource: Record<string, unknown>) =>
        getFirstArrayIdentifierValue(
          (resource.subject as Record<string, unknown> | undefined)?.identifier
        )
    },
    {
      type: "Patient",
      extractor: (resource: Record<string, unknown>) =>
        getFirstArrayIdentifierValue(resource.identifier)
    },
    {
      type: "Task",
      extractor: (resource: Record<string, unknown>) =>
        getIdentifierValue(resource, "for")
    }
  ];

  for (const {type, extractor} of order) {
    for (const resource of resources) {
      if (resource.resourceType === type) {
        const value = extractor(resource);
        if (value) {
          return value;
        }
      }
    }
  }

  return "unknown-nhs-number";
}

function collectResources(entries: Record<string, unknown>[]): Record<string, unknown>[] {
  const resources: Record<string, unknown>[] = [];

  for (const entry of entries) {
    const resource = entry.resource as Record<string, unknown> | undefined;
    if (!resource || typeof resource !== "object") {
      continue;
    }

    resources.push(resource);

    const nestedEntries = Array.isArray(resource.entry)
      ? (resource.entry as Record<string, unknown>[])
      : [];

    for (const nested of nestedEntries) {
      const nestedResource = nested.resource as Record<string, unknown> | undefined;
      if (nestedResource && typeof nestedResource === "object") {
        resources.push(nestedResource);
      }
    }
  }

  return resources;
}

function getFirstArrayIdentifierValue(input: unknown): string | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const first = input[0] as Record<string, unknown> | undefined;
  const value = first?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getIdentifierValue(
  resource: Record<string, unknown>,
  field: string
): string | null {
  const container = resource[field] as Record<string, unknown> | undefined;
  if (!container) {
    return null;
  }

  const identifier = container.identifier as Record<string, unknown> | undefined;
  const value = identifier?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}
