import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface BundleLike {
  resourceType: "Bundle";
  entry?: Array<{
    resource?: {
      resourceType?: string;
      identifier?: Array<{ value?: string }>;
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

  throw new Error(
    "set DISPENSING_PRIVATE_KEY or DISPENSING_PRIVATE_KEY_PATH in your .env",
  );
}

export function loadParameters(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function generateTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
}

export function saveJsonPayload(
  payload: unknown,
  saveDir: string,
  fileName: string,
): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, { recursive: true });
  }

  const outputPath = join(saveDir, fileName);
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  return outputPath;
}

export function saveRequest(
  action: string,
  payload: unknown,
  saveDir: string,
  requestId?: string,
  correlationId?: string,
): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, { recursive: true });
  }

  const timestamp = generateTimestamp();
  const ids =
    requestId && correlationId ? `_${requestId}:${correlationId}` : "";
  const fileName = `${timestamp}_${action}${ids}_request.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  return outputPath;
}

export function saveResponse(
  action: string,
  payload: unknown,
  saveDir: string,
  requestId?: string,
  correlationId?: string,
): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, { recursive: true });
  }

  const timestamp = generateTimestamp();
  const ids =
    requestId && correlationId ? `_${requestId}:${correlationId}` : "";
  const fileName = `${timestamp}_${action}${ids}_response.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  return outputPath;
}

export function saveBundle(
  action: string,
  bundle: BundleLike,
  saveDir: string,
  prescriptionId: string,
): string {
  return saveResponse(action, bundle, saveDir);
}
