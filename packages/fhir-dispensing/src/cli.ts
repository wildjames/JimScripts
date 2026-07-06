#!/usr/bin/env node

import { existsSync } from "fs";

import { Command } from "commander";
import { config } from "dotenv";

import {
  obtainAppRestrictedAccessToken,
  obtainUserRestrictedAccessToken,
} from "eps-auth";

import {
  generateReleaseParameters,
  normalizeReleaseParameters,
} from "./payload.js";
import { releaseTask } from "./release.js";
import { returnPrescription, RETURN_REASON_CODES } from "./return.js";
import { dispenseNotification, DISPENSE_TYPE_CODES } from "./dispense.js";
import {
  getEnv,
  loadParameters,
  loadPrivateKey,
  saveBundle,
  BundleLike,
} from "./utils.js";

const SUPPORTED_ACTIONS = [
  "release",
  "return",
  "dispense",
  "withdraw",
  "claim",
] as const;
type DispensingAction = (typeof SUPPORTED_ACTIONS)[number];

function parseAction(action: string): DispensingAction {
  if (!SUPPORTED_ACTIONS.includes(action as DispensingAction)) {
    throw new Error(
      `Unknown action '${action}'. Allowed actions: ${SUPPORTED_ACTIONS.join(", ")}`,
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
      "Call EPS FHIR Dispensing actions (release, return, dispense, withdraw, claim)",
    )
    .option(
      "--action <action>",
      `Dispensing action (${SUPPORTED_ACTIONS.join(", ")})`,
      "release",
    )
    .option(
      "--prescription-id <id>",
      "EPS prescription group identifier (short-form prescription ID)",
    )
    .option(
      "--input <file>",
      "Optional path to a Parameters JSON request body; if omitted a fake request is generated",
    )
    .option(
      "--app-restricted",
      "Use application-restricted auth and call $release-unattended (default is user-restricted $release)",
      false,
    )
    .option(
      "--save-dir <directory>",
      "Directory to save the downloaded Bundle JSON",
      "./data/prescriptions",
    )
    .option("--urid <urid>", "NHSD-Session-URID override")
    .option("--pharmacy-ods <code>", "Pharmacy ODS code for the release owner")
    .option(
      "--reason-code <code>",
      "Return reason code from EPS-task-dispense-return-status-reason CodeSystem (required for --action return)",
    )
    .option(
      "--reason-text <text>",
      "Optional human-readable return reason text (overrides the default display for the reason code)",
    )
    .option(
      "--reimbursement-authority <code>",
      "Reimbursement authority ODS code (for dispense action)",
    )
    .option(
      "--dispense-type <code>",
      "Dispense type code from medicationdispense-type CodeSystem (default: 0001 = Item fully dispensed)",
      "0001",
    );

  program.parse();
  const options = program.opts<{
    action: string;
    prescriptionId?: string;
    input?: string;
    appRestricted?: boolean;
    saveDir: string;
    urid?: string;
    pharmacyOds?: string;
    reasonCode?: string;
    reasonText?: string;
    reimbursementAuthority?: string;
    dispenseType?: string;
  }>();

  const action = parseAction(options.action);

  if (
    !options.prescriptionId &&
    !(action === "release" && options.appRestricted)
  ) {
    throw new Error(
      "--prescription-id is required unless using --app-restricted with release action",
    );
  }

  if (action === "return" && !options.reasonCode) {
    const validCodes = Object.entries(RETURN_REASON_CODES)
      .map(([code, display]) => `  ${code} - ${display}`)
      .join("\n");
    throw new Error(
      `--reason-code is required for action 'return'. Valid codes:\n${validCodes}`,
    );
  }

  if (action === "return" && options.appRestricted) {
    throw new Error(
      "Action 'return' only supports user-restricted authentication",
    );
  }

  if (options.input && !existsSync(options.input)) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  const host = getEnv("HOST");
  const mode = options.appRestricted ? "unattended" : "attended";

  let token: string;
  let urid = options.urid;

  if (options.appRestricted) {
    console.log(
      "Using application-restricted authentication with $release-unattended",
    );
    const apiKey = getEnv("DISPENSING_API_KEY");
    const kid = getEnv("DISPENSING_KID");
    const privateKey = loadPrivateKey();

    token = await obtainAppRestrictedAccessToken({
      host,
      apiKey,
      kid,
      privateKey,
    });

    console.log("Got access token for app-restricted auth");

    if (urid) {
      console.log("Ignoring NHSD-Session-URID for $release-unattended");
      urid = undefined;
    }
  } else {
    console.log("Using user-restricted authentication");
    const clientId = getEnv("DISPENSING_API_KEY");
    const clientSecret = getEnv("DISPENSING_APP_CLIENT_SECRET");
    const redirectUri = getEnv("DISPENSING_CALLBACK_URL");

    const authResult = await obtainUserRestrictedAccessToken({
      host,
      clientId,
      clientSecret,
      redirectUri,
      userType: "dispenser",
    });

    token = authResult.accessToken;
    urid = urid ?? authResult.urid;
  }

  let result: ActionExecutionResult;

  switch (action) {
    case "release": {
      const body = options.input
        ? normalizeReleaseParameters(
            loadParameters(options.input),
            options.prescriptionId,
            {
              includeAgent: mode === "attended",
              pharmacyOds: options.pharmacyOds,
              includeGroupIdentifier: mode === "attended",
            },
          )
        : generateReleaseParameters(options.prescriptionId, {
            includeAgent: mode === "attended",
            pharmacyOds: options.pharmacyOds,
            includeGroupIdentifier: mode === "attended",
          });

      result = await releaseTask({
        host,
        token,
        body,
        mode,
        urid,
        requestSaveDir: options.saveDir,
      });
      break;
    }
    case "return":
      if (options.appRestricted) {
        throw new Error(
          "Action 'dispense' only supports user-restricted authentication",
        );
      }
      result = await returnPrescription(
        {
          prescriptionId: options.prescriptionId!,
          reasonCode: options.reasonCode!,
          reasonText: options.reasonText,
          pharmacyOds: options.pharmacyOds,
        },
        {
          host,
          token,
          urid,
          requestSaveDir: options.saveDir,
        },
      );
      break;
    case "dispense": {
      if (!options.input) {
        throw new Error(
          "--input is required for action 'dispense' (path to released prescription bundle)",
        );
      }
      if (options.appRestricted) {
        throw new Error(
          "Action 'dispense' only supports user-restricted authentication",
        );
      }
      const inputBundle = loadParameters(options.input) as Record<
        string,
        unknown
      > & { resourceType: "Bundle" };
      result = await dispenseNotification(
        inputBundle as Parameters<typeof dispenseNotification>[0],
        {
          prescriptionId: options.prescriptionId!,
          pharmacyOds: options.pharmacyOds,
          reimbursementAuthority: options.reimbursementAuthority,
          dispenseType: options.dispenseType,
        },
        {
          host,
          token,
          urid,
          requestSaveDir: options.saveDir,
        },
      );
      break;
    }
    case "withdraw":
      throw new Error("Action 'withdraw' is not implemented yet");
    case "claim":
      throw new Error("Action 'claim' is not implemented yet");
    default:
      throw new Error(`Unknown action '${action}'`);
  }

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(
    `Response: ${result.response.status} ${result.response.statusText}`,
  );

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.responseBody, null, 2));
    throw new Error(`Task ${action} request failed`);
  }

  const bundlePath = saveBundle(
    action,
    result.responseBody as BundleLike,
    options.saveDir,
    options.prescriptionId ?? "no-prescription-id",
  );
  console.log(bundlePath);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
