#!/usr/bin/env node

import {Command} from "commander";
import {config} from "dotenv";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

import {
  submitPrescriptionWithToken,
  createAndSubmitCancellation,
  preparePrescription,
  prepareAndSign,
  parseCancellationReasonType,
  CANCELLATION_REASON_TYPES,
  SUPPORTED_ACTIONS,
  type BundleLike,
  type PrescriptionAction
} from "./index.js";
import {getEnv, loadPrivateKey} from "./utils.js";
import {obtainUserRestrictedAccessToken, type Cis2UserType} from "./user-auth.js";

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

async function handleCreate(options: {input: string; saveDir: string; urid?: string; algorithm?: string; userType?: string}): Promise<void> {
  const privateKey = loadPrivateKey();
  const host = getEnv("HOST");
  const inputBundle = readInputBundle(options.input);

  let result;

  const clientId = getEnv("PRESCRIBE_APP_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const {accessToken, urid} = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType
  });

  result = await submitPrescriptionWithToken({
    host,
    token: accessToken,
    privateKey,
    bundle: inputBundle,
    urid: options.urid ?? urid,
    algorithm: options.algorithm
  });

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(`Response: ${result.response.status} ${result.response.statusText}`);

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.response.body, null, 2));
    throw new Error("Prescription submission failed");
  }

  const outputPath = saveBundle("create", result.signedBundle, options.saveDir);
  console.log(outputPath);
}

async function handleCancel(options: {
  input: string;
  saveDir: string;
  urid?: string;
  userType?: string;
  cancelReasonType?: string;
}): Promise<void> {
  const host = getEnv("HOST");
  const inputBundle = readInputBundle(options.input);

  const clientId = getEnv("PRESCRIBE_APP_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const {accessToken, urid} = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType
  });

  const result = await createAndSubmitCancellation({
    host,
    token: accessToken,
    bundle: inputBundle,
    urid: options.urid ?? urid,
    cancellationReasonType: parseCancellationReasonType(options.cancelReasonType)
  });

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(`Response: ${result.response.status} ${result.response.statusText}`);

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.response.body, null, 2));
    throw new Error("Cancellation request failed");
  }

  const outputPath = saveBundle("cancel", result.cancellationBundle, options.saveDir);
  console.log(outputPath);
}

async function handleSign(options: {input: string; urid?: string; algorithm?: string; prepareOnly?: boolean; userType?: string}): Promise<void> {
  const privateKey = loadPrivateKey();
  const host = getEnv("HOST");
  const bundle = JSON.parse(readFileSync(options.input, "utf-8"));

  let token: string;
  let resolvedUrid = options.urid;

  const clientId = getEnv("PRESCRIBE_APP_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const authResult = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType
  });
  token = authResult.accessToken;
  resolvedUrid = resolvedUrid ?? authResult.urid;

  if (options.prepareOnly) {
    const {digest, timestamp} = await preparePrescription(host, token, bundle, resolvedUrid);
    console.log(JSON.stringify({digest, timestamp}, null, 2));
  } else {
    const result = await prepareAndSign(
      host,
      token,
      bundle,
      privateKey,
      resolvedUrid,
      options.algorithm
    );

    console.log("Digest:", result.digest);
    console.log("Signature:", result.signature);
    console.log("Timestamp:", result.timestamp);
  }
}

async function main(): Promise<void> {
  config();

  const program = new Command();

  program
    .name("fhir-prescribing")
    .description("Perform EPS FHIR prescribing actions: create, cancel, sign, and more")
    .requiredOption("--action <action>", `Action to perform (${SUPPORTED_ACTIONS.join(" | ")})`)
    .requiredOption("--input <file>", "Input prescription bundle JSON file")
    .option("--save-dir <directory>", "Directory to save output Bundle JSON", "./data/prescriptions")
    .option("--urid <urid>", "NHSD-Session-URID value (create/cancel/sign)")
    .option("--algorithm <alg>", "Signing algorithm (create/sign)", "RSA-SHA1")
    .option(
      "--cancel-reason-type <code>",
      `Cancellation reason type for cancel action (${CANCELLATION_REASON_TYPES.join(" | ")})`,
      "0001"
    )
    .option("--prepare-only", "Only call $prepare and return the digest without signing (sign only)", false)
    .option("--user-restricted", "Use user-restricted (CIS2 browser) auth instead of app-restricted", false)
    .option("--user-type <type>", "CIS2 user type: prescriber or dispenser (user-restricted only)", "prescriber");

  program.parse();
  const opts = program.opts<{
    action: string;
    input: string;
    saveDir: string;
    urid?: string;
    algorithm?: string;
    cancelReasonType?: string;
    prepareOnly?: boolean;
    userRestricted?: boolean;
    userType?: string;
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
      await handleCancel(opts);
      break;
    case "sign":
      await handleSign(opts);
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
