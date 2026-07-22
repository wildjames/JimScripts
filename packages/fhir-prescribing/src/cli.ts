#!/usr/bin/env node

import crypto from "crypto";
import { Command } from "commander";
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
  submitPrescriptionWithToken,
  createAndSubmitCancellation,
  preparePrescription,
  prepareAndSign,
  parseCancellationReasonType,
  CANCELLATION_REASON_TYPES,
  SUPPORTED_ACTIONS,
  type BundleLike,
  type PrescriptionAction,
  signDigest,
  addProvenanceToBundle,
} from "./index.js";
import { getEnv, loadPrivateKey } from "./utils.js";
import { signWithDss } from "signing-service";
import {
  obtainUserRestrictedAccessToken,
  CIS2_USERS,
  type Cis2UserType,
} from "eps-auth";

function readInputBundle(filePath: string): BundleLike {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as BundleLike;
}

function generateTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
}

function savePayload(
  action: PrescriptionAction,
  type: "request" | "response",
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
  const fileName = `${timestamp}_${action}${ids}_${type}.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  return outputPath;
}

function parseAction(action: string): PrescriptionAction {
  if (!SUPPORTED_ACTIONS.includes(action as PrescriptionAction)) {
    throw new Error(
      `Unknown action '${action}'. Allowed actions: ${SUPPORTED_ACTIONS.join(", ")}`,
    );
  }

  return action as PrescriptionAction;
}

async function handleCreate(options: {
  input: string;
  saveDir: string;
  urid?: string;
  algorithm?: string;
  userType?: string;
  dss?: boolean;
  dssHost?: string;
  dssMock?: boolean;
}): Promise<void> {
  const privateKey = loadPrivateKey();
  const host = getEnv("HOST");
  const inputBundle = readInputBundle(options.input);

  let result;

  const clientId = getEnv("PRESCRIBE_API_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const { accessToken, urid } = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
  });

  // If the incoming payload already has a provenance resource, do not replace it, and use the existing one
  const signedBundle: BundleLike = inputBundle.entry?.some(
    (e) => e.resource?.resourceType === "Provenance",
  )
    ? inputBundle
    : await (async () => {
        const { digest, timestamp, algorithm } = await preparePrescription(
          host,
          accessToken,
          inputBundle,
          urid,
        );

        if (options.dss) {
          const kid = getEnv("PRESCRIBE_KID");
          const dssCallbackUrl = process.env.DSS_CALLBACK_URL ?? redirectUri;
          const sdsUserId = CIS2_USERS[userType].userId;
          const payloadId = crypto.randomUUID();
          const dssHost = options.dssHost ?? host;

          const dssResult = await signWithDss({
            host: dssHost,
            accessToken,
            apiKey: clientId,
            kid,
            privateKey,
            sdsUserId,
            digests: [{ id: payloadId, payload: digest }],
            algorithm,
            callbackUrl: dssCallbackUrl,
            mock: options.dssMock,
          });

          const dssSignature =
            dssResult.signatures.find((s) => s.id === payloadId) ??
            (dssResult.signatures.length === 1
              ? dssResult.signatures[0]
              : undefined);
          if (!dssSignature) {
            throw new Error(
              "DSS did not return a signature for the requested payload",
            );
          }

          return addProvenanceToBundle(
            inputBundle,
            digest,
            dssSignature.signature,
            timestamp,
            dssResult.certificate,
          );
        }

        const signature = signDigest(digest, privateKey, options.algorithm);

        return addProvenanceToBundle(inputBundle, digest, signature, timestamp);
      })();

  // Submit the signed bundle
  result = await submitPrescriptionWithToken({
    host,
    token: accessToken,
    privateKey,
    bundle: signedBundle,
    urid: options.urid ?? urid,
    algorithm: options.algorithm,
  });

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(
    `Response: ${result.response.status} ${result.response.statusText}`,
  );

  // Save the signed bundle (request) with IDs now available
  const signedBundlePath = savePayload(
    "create",
    "request",
    signedBundle,
    options.saveDir,
    result.requestId,
    result.correlationId,
  );
  console.log(
    `Signed bundle (which will be submitted to the FHIR Facade) saved to: ${signedBundlePath}`,
  );

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.response.body, null, 2));
    throw new Error("Prescription submission failed");
  }

  const outputPath = savePayload(
    "create",
    "response",
    result.response.body as BundleLike,
    options.saveDir,
    result.requestId,
    result.correlationId,
  );
  console.log(`Response bundle saved to: ${outputPath}`);
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

  const clientId = getEnv("PRESCRIBE_API_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const { accessToken, urid } = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
  });

  const result = await createAndSubmitCancellation({
    host,
    token: accessToken,
    bundle: inputBundle,
    urid: options.urid ?? urid,
    cancellationReasonType: parseCancellationReasonType(
      options.cancelReasonType,
    ),
  });

  console.log(`Request ID: ${result.requestId}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  console.log(
    `Response: ${result.response.status} ${result.response.statusText}`,
  );

  if (result.response.status >= 400) {
    console.log(JSON.stringify(result.response.body, null, 2));
    throw new Error("Cancellation request failed");
  }

  const requestPath = savePayload(
    "cancel",
    "request",
    result.cancellationBundle,
    options.saveDir,
    result.requestId,
    result.correlationId,
  );
  console.log(`Cancel request saved to: ${requestPath}`);

  const responsePath = savePayload(
    "cancel",
    "response",
    result.response.body,
    options.saveDir,
    result.requestId,
    result.correlationId,
  );
  console.log(`Cancel response saved to: ${responsePath}`);
}

async function handleSign(options: {
  input: string;
  urid?: string;
  algorithm?: string;
  prepareOnly?: boolean;
  userType?: string;
  dss?: boolean;
  dssHost?: string;
  dssMock?: boolean;
}): Promise<void> {
  const privateKey = loadPrivateKey();
  const host = getEnv("HOST");
  const bundle = JSON.parse(readFileSync(options.input, "utf-8"));

  let token: string;
  let resolvedUrid = options.urid;

  const clientId = getEnv("PRESCRIBE_API_KEY");
  const clientSecret = getEnv("PRESCRIBE_APP_CLIENT_SECRET");
  const redirectUri = getEnv("PRESCRIBE_CALLBACK_URL");
  const userType = (options.userType ?? "prescriber") as Cis2UserType;

  const authResult = await obtainUserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
  });
  token = authResult.accessToken;
  resolvedUrid = resolvedUrid ?? authResult.urid;

  if (options.prepareOnly) {
    const { digest, timestamp } = await preparePrescription(
      host,
      token,
      bundle,
      resolvedUrid,
    );
    console.log(JSON.stringify({ digest, timestamp }, null, 2));
  } else {
    const { digest, timestamp, algorithm } = await preparePrescription(
      host,
      token,
      bundle,
    );

    let signature: string;
    let certificate: string | undefined;

    if (options.dss) {
      const clientId = getEnv("PRESCRIBE_API_KEY");
      const kid = getEnv("PRESCRIBE_KID");
      const dssCallbackUrl =
        process.env.DSS_CALLBACK_URL ??
        process.env.PRESCRIBE_CALLBACK_URL ??
        "";
      const sdsUserId = CIS2_USERS[userType].userId;
      const payloadId = crypto.randomUUID();
      const dssHost = options.dssHost ?? host;

      const dssResult = await signWithDss({
        host: dssHost,
        accessToken: token,
        apiKey: clientId,
        kid,
        privateKey,
        sdsUserId,
        digests: [{ id: payloadId, payload: digest }],
        algorithm,
        callbackUrl: dssCallbackUrl,
        mock: options.dssMock,
      });

      const dssSignature =
        dssResult.signatures.find((s) => s.id === payloadId) ??
        (dssResult.signatures.length === 1
          ? dssResult.signatures[0]
          : undefined);
      if (!dssSignature) {
        throw new Error(
          "DSS did not return a signature for the requested payload",
        );
      }

      signature = dssSignature.signature;
      certificate = dssResult.certificate;
    } else {
      signature = signDigest(digest, privateKey, options.algorithm);
    }

    const signedBundle = addProvenanceToBundle(
      bundle,
      digest,
      signature,
      timestamp,
      certificate,
    );

    console.log("Digest:", digest);
    console.log("Signature:", signature);
    console.log("Timestamp:", timestamp);
    if (certificate) {
      console.log("Certificate: (from DSS)");
    }

    const outputPath = savePayload(
      "sign",
      "response",
      signedBundle,
      "./data/prescriptions",
    );
    console.log(`Signed bundle saved to: ${outputPath}`);
  }
}

async function main(): Promise<void> {
  config();

  const program = new Command();

  program
    .name("fhir-prescribing")
    .description(
      "Perform EPS FHIR prescribing actions: create, cancel, sign, and more",
    )
    .requiredOption(
      "--action <action>",
      `Action to perform (${SUPPORTED_ACTIONS.join(" | ")})`,
    )
    .requiredOption("--input <file>", "Input prescription bundle JSON file")
    .option(
      "--save-dir <directory>",
      "Directory to save output Bundle JSON",
      "./data/prescriptions",
    )
    .option("--urid <urid>", "NHSD-Session-URID value (create/cancel/sign)")
    .option("--algorithm <alg>", "Signing algorithm (create/sign)", "RSA-SHA1")
    .option(
      "--cancel-reason-type <code>",
      `Cancellation reason type for cancel action (${CANCELLATION_REASON_TYPES.join(" | ")})`,
      "0001",
    )
    .option(
      "--prepare-only",
      "Only call $prepare and return the digest without signing (sign only)",
      false,
    )
    .option(
      "--user-restricted",
      "Use user-restricted (CIS2 browser) auth instead of app-restricted",
      false,
    )
    .option(
      "--user-type <type>",
      "CIS2 user type: prescriber or dispenser (user-restricted only)",
      "prescriber",
    )
    .option(
      "--dss",
      "Use the NHS Digital Signature Service (DSS) for signing instead of local key",
      false,
    )
    .option(
      "--dss-host <host>",
      "Override the DSS host (defaults to HOST env var; use sandbox.api.service.nhs.uk for sandbox testing)",
    )
    .option(
      "--dss-mock",
      "Use mock mode for DSS presence check (auto-completes without smartcard; produces dummy signatures)",
      false,
    );

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
    dss?: boolean;
    dssHost?: string;
    dssMock?: boolean;
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
