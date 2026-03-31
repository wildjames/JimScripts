#!/usr/bin/env node

import {Command} from "commander";
import {config} from "dotenv";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

import {
  createAndSubmitPrescription,
  createCancellationBundle,
  SUPPORTED_ACTIONS,
  type BundleLike,
  type PrescriptionAction
} from "./index.js";

function readInputBundle(filePath: string): BundleLike {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as BundleLike;
}

function findNhsNumber(bundle: BundleLike): string {
  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;
    if (resource?.resourceType !== "Patient") {
      continue;
    }

    const value = resource.identifier?.[0]?.value;
    if (value) {
      return value;
    }
  }

  return "unknown-nhs-number";
}

function saveBundle(action: PrescriptionAction, bundle: BundleLike, saveDir: string): string {
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

  const fileName = `${action}-bundle_${timestamp}_nhs-num-${nhsNumber}.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
  return outputPath;
}

function parseAction(action: string): PrescriptionAction {
  if (!SUPPORTED_ACTIONS.includes(action as PrescriptionAction)) {
    throw new Error(
      `Unknown action '${action}'. Allowed actions: ${SUPPORTED_ACTIONS.join(", ")}`
    );
  }

  return action as PrescriptionAction;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }
  return value;
}

function loadPrivateKey(): string {
  const key = process.env.PRESCRIBE_PRIVATE_KEY;
  const path = process.env.PRESCRIBE_PRIVATE_KEY_PATH;

  if (key) {
    return key.replace(/\\n/g, "\n");
  }

  if (path && existsSync(path)) {
    return readFileSync(path, "utf-8");
  }

  throw new Error("set PRESCRIBE_PRIVATE_KEY or PRESCRIBE_PRIVATE_KEY_PATH in your .env");
}

async function handleCreate(options: {input: string; saveDir: string; urid?: string; algorithm?: string}): Promise<void> {
  const privateKey = loadPrivateKey();
  const apiKey = getEnv("PRESCRIBE_API_KEY");
  const host = getEnv("HOST");
  const kid = getEnv("PRESCRIBE_KID");

  const inputBundle = readInputBundle(options.input);

  const result = await createAndSubmitPrescription({
    host,
    apiKey,
    kid,
    privateKey,
    bundle: inputBundle,
    urid: options.urid,
    algorithm: options.algorithm
  });

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(`Response: ${result.response.status} ${result.response.statusText}`);
  console.log(JSON.stringify(result.response.body, null, 2));

  const outputPath = saveBundle("create", result.signedBundle, options.saveDir);
  console.log(outputPath);
}

function handleCancel(options: {input: string; saveDir: string}): void {
  const inputBundle = readInputBundle(options.input);
  const outputBundle = createCancellationBundle(inputBundle);

  console.log(JSON.stringify(outputBundle, null, 2));

  const outputPath = saveBundle("cancel", outputBundle, options.saveDir);
  console.log(outputPath);
}

async function main(): Promise<void> {
  config();

  const program = new Command();

  program
    .name("fhir-prescribing")
    .description("Perform EPS FHIR prescribing actions: create, cancel, and more")
    .requiredOption("--action <action>", `Action to perform (${SUPPORTED_ACTIONS.join(" | ")})`)
    .requiredOption("--input <file>", "Input prescription bundle JSON file")
    .option("--save-dir <directory>", "Directory to save output Bundle JSON", "./data/prescriptions")
    .option("--urid <urid>", "NHSD-Session-URID value (create only)")
    .option("--algorithm <alg>", "Signing algorithm (create only)", "RSA-SHA1");

  program.parse();
  const opts = program.opts<{
    action: string;
    input: string;
    saveDir: string;
    urid?: string;
    algorithm?: string;
  }>();

  const action = parseAction(opts.action.toLowerCase());

  if (!existsSync(opts.input)) {
    throw new Error(`Input file not found: ${opts.input}`);
  }

  switch (action) {
    case "create":
      await handleCreate(opts);
      break;
    case "cancel":
      handleCancel(opts);
      break;
    default:
      throw new Error(`Action '${action}' is not yet implemented.`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
