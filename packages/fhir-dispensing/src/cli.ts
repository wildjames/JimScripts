#!/usr/bin/env node

import {existsSync} from "fs";

import {Command} from "commander";
import {config} from "dotenv";

import {generateReleaseParameters, normalizeReleaseParameters} from "./payload.js";
import {
  extractReleasedBundle,
  obtainAppRestrictedToken,
  obtainUserRestrictedToken,
  releaseTask
} from "./release.js";
import {getEnv, loadParameters, loadPrivateKey, saveBundle} from "./utils.js";

const SUPPORTED_ACTIONS = ["release", "return", "dispense", "withdraw", "claim"] as const;
type DispensingAction = typeof SUPPORTED_ACTIONS[number];

function parseAction(action: string): DispensingAction {
  if (!SUPPORTED_ACTIONS.includes(action as DispensingAction)) {
    throw new Error(
      `Unknown action '${action}'. Allowed actions: ${SUPPORTED_ACTIONS.join(", ")}`
    );
  }

  return action as DispensingAction;
}

interface ActionExecutionResult {
  response: Response;
  requestId: string;
  correlationId: string;
  responseBody: unknown;
}

async function main(): Promise<void> {
  config();

  const program = new Command();

  program
    .name("fhir-dispensing")
    .description(
      "Call EPS FHIR Dispensing actions (release, return, dispense, withdraw, claim)"
    )
    .option(
      "--action <action>",
      `Dispensing action (${SUPPORTED_ACTIONS.join(", ")})`,
      "release"
    )
    .requiredOption(
      "--prescription-id <id>",
      "EPS prescription group identifier (short-form prescription ID)"
    )
    .option(
      "--input <file>",
      "Optional path to a Parameters JSON request body; if omitted a fake request is generated"
    )
    .option(
      "--app-restricted",
      "Use application-restricted auth and call $release-unattended (default is user-restricted $release)",
      false
    )
    .option(
      "--save-dir <directory>",
      "Directory to save the downloaded Bundle JSON",
      "./data/prescriptions"
    )
    .option("--urid <urid>", "NHSD-Session-URID override")
    .option("--pharmacy-ods <code>", "Pharmacy ODS code for the release owner");

  program.parse();
  const options = program.opts<{
    action: string;
    prescriptionId: string;
    input?: string;
    appRestricted?: boolean;
    saveDir: string;
    urid?: string;
    pharmacyOds?: string;
  }>();

  const action = parseAction(options.action);

  if (options.input && !existsSync(options.input)) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  const host = getEnv("HOST");
  const mode = options.appRestricted ? "unattended" : "attended";
  const body = options.input
    ? normalizeReleaseParameters(loadParameters(options.input), options.prescriptionId, {
      includeAgent: mode === "attended",
      pharmacyOds: options.pharmacyOds
    })
    : generateReleaseParameters(options.prescriptionId, {
      includeAgent: mode === "attended",
      pharmacyOds: options.pharmacyOds
    });

  let token: string;
  let urid = options.urid;

  if (options.appRestricted) {
    console.log("Using application-restricted authentication with $release-unattended");
    const apiKey = getEnv("DISPENSING_API_KEY");
    const kid = getEnv("DISPENSING_KID");
    const privateKey = loadPrivateKey();

    token = await obtainAppRestrictedToken({
      host,
      apiKey,
      kid,
      privateKey
    });

    console.log("Got access token for app-restricted auth");

    if (urid) {
      console.log("Ignoring NHSD-Session-URID for $release-unattended");
      urid = undefined;
    }

  } else {
    console.log("Using user-restricted authentication with $release");
    const clientId = getEnv("DISPENSING_API_KEY");
    const clientSecret = getEnv("DISPENSING_APP_CLIENT_SECRET");
    const redirectUri = getEnv("DISPENSING_CALLBACK_URL");

    const authResult = await obtainUserRestrictedToken({
      host,
      clientId,
      clientSecret,
      redirectUri,
      userType: "dispenser"
    });

    token = authResult.accessToken;
    urid = urid ?? authResult.urid;
  }

  let result: ActionExecutionResult;

  switch (action) {
    case "release":
      result = await releaseTask({
        host,
        token,
        body,
        mode,
        urid,
        requestSaveDir: options.saveDir
      });
      break;
    case "return":
      throw new Error("Action 'return' is not implemented yet");
    case "dispense":
      throw new Error("Action 'dispense' is not implemented yet");
    case "withdraw":
      throw new Error("Action 'withdraw' is not implemented yet");
    case "claim":
      throw new Error("Action 'claim' is not implemented yet");
    default:
      throw new Error(`Unknown action '${action}'`);
  }

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(`Response: ${result.response.status} ${result.response.statusText}`);

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.responseBody, null, 2));
    throw new Error("Task release request failed");
  }

  const releasedBundle = extractReleasedBundle(result.responseBody);
  if (!releasedBundle) {
    throw new Error("Release response did not contain a Bundle resource to save");
  }

  const outputPath = saveBundle(
    "release",
    releasedBundle,
    options.saveDir,
    options.prescriptionId
  );
  console.log(outputPath);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
