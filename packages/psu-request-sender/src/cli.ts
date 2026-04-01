#!/usr/bin/env node

import {Command} from "commander";
import {config} from "dotenv";

import {obtainAccessToken, sendPsu} from "./psu.js";
import {getEnv, loadBundle, loadPrivateKey} from "./utils.js";

async function main(): Promise<void> {
  config();

  const descriptionParts = [
    "Send a Prescription Status Update bundle to the PSU endpoint.",
    "-->> Required environment variables:",
    "- PSU_API_KEY: APIM application API key",
    "- HOST: e.g. internal-dev.api.service.nhs.uk",
    "- PSU_KID: key ID from APIM portal",
    "- PSU_PRIVATE_KEY: PEM contents of the private key or PSU_PRIVATE_KEY_PATH: path to PEM file"
  ];

  const program = new Command();
  program
    .name("send-psu-request")
    .description(descriptionParts.join("\n"))
    .requiredOption("--input <file>", "Path to JSON bundle file");

  program.parse();
  const options = program.opts();

  const privateKey = loadPrivateKey();
  const apiKey = getEnv("PSU_API_KEY");
  const host = getEnv("HOST");
  const kid = getEnv("PSU_KID");

  const bundle = loadBundle(options.input);

  const token = await obtainAccessToken(host, apiKey, kid, privateKey);
  const {response, requestId, correlationId} = await sendPsu(host, token, bundle);

  console.log(`Request ID: ${requestId}`);
  console.log(`Correlation ID: ${correlationId}`);
  console.log(`Response: ${response.status} ${response.statusText}`);

  if (response.status >= 400) {
    const responseBody = await response.text();
    console.log("Response body:", responseBody);
    throw new Error("PSU request failed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
