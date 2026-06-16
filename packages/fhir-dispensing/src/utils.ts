import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

import {findNhsNumber} from "nhs-number-utils";


export interface BundleLike {
  resourceType: "Bundle";
  entry?: Array<{
    resource?: {
      resourceType?: string;
      identifier?: Array<{value?: string}>;
    };
  }>;
}

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }

  return value;
}

export function loadPrivateKey(): string {
  const key = process.env.DISPENSING_PRIVATE_KEY;
  const path = process.env.DISPENSING_PRIVATE_KEY_PATH;

  if (key) {
    return key.replace(/\\n/g, "\n");
  }

  if (path && existsSync(path)) {
    return readFileSync(path, "utf-8");
  }

  throw new Error("set DISPENSING_PRIVATE_KEY or DISPENSING_PRIVATE_KEY_PATH in your .env");
}

export function loadParameters(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

export function saveJsonPayload(
  payload: unknown,
  saveDir: string,
  fileName: string
): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, {recursive: true});
  }

  const outputPath = join(saveDir, fileName);
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  return outputPath;
}

export function saveBundle(
  action: string,
  bundle: BundleLike,
  saveDir: string,
  prescriptionId: string
): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, {recursive: true});
  }

  const nhsNumber = findNhsNumber(bundle);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .split("-")
    .slice(0, 6)
    .join("");

  const suffix = nhsNumber
    ? `nhs-num-${nhsNumber}`
    : `prescription-id-${prescriptionId}`;
  const fileName = `${action}-bundle_${timestamp}_${suffix}.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
  return outputPath;
}
