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
    "- API_KEY: APIM application API key",
    "- HOST: e.g. internal-dev.api.service.nhs.uk",
    "- KID: key ID from APIM portal",
    "- PRIVATE_KEY: PEM contents of the private key or PRIVATE_KEY_PATH: path to PEM file"
  ];

  const program = new Command();
  program
    .name("send-psu-request")
    .description(descriptionParts.join(" "))
    .requiredOption("--input <file>", "Path to JSON bundle file");

  program.parse();
  const options = program.opts<{input: string}>();

  const privateKey = loadPrivateKey();
  const apiKey = getEnv("API_KEY");
  const host = getEnv("HOST");
  const kid = getEnv("KID");

  const bundle = loadBundle(options.input);

  const token = await obtainAccessToken(host, apiKey, kid, privateKey);
  const {response, requestId, correlationId} = await sendPsu(host, token, bundle);

  console.log(`Request ID: ${requestId}`);
  console.log(`Correlation ID: ${correlationId}`);
  console.log(`Response: ${response.status} ${response.statusText}`);

  const bodyText = await response.text();
  try {
    const payload = JSON.parse(bodyText);
    console.log(JSON.stringify(payload, null, 2));
  } catch {
    console.log(bodyText);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
