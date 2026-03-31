#!/usr/bin/env node

import {Command} from "commander";
import {config} from "dotenv";

import {obtainAccessToken, prepareAndSign, preparePrescription, signDigest} from "./signer.js";
import {getEnv, loadBundle, loadPrivateKey} from "./utils.js";

async function main(): Promise<void> {
  config();

  const descriptionParts = [
    "Send a FHIR prescription bundle to $prepare and sign the returned digest.",
    "-->> Required environment variables:",
    "- PRESCRIBE_API_KEY: APIM application API key",
    "- HOST: e.g. internal-dev.api.service.nhs.uk",
    "- PRESCRIBE_KID: key ID from APIM portal",
    "- PRESCRIBE_PRIVATE_KEY: PEM contents of the private key or PRESCRIBE_PRIVATE_KEY_PATH: path to PEM file"
  ];

  const program = new Command();
  program
    .name("sign-prescription")
    .description(descriptionParts.join("\n"))
    .requiredOption("--input <file>", "Path to FHIR prescription bundle JSON file")
    .option("--urid <urid>", "NHSD-Session-URID value")
    .option("--algorithm <alg>", "Signing algorithm", "RSA-SHA1")
    .option("--prepare-only", "Only call $prepare and return the digest without signing", false);

  program.parse();
  const options = program.opts();

  const privateKey = loadPrivateKey();
  const apiKey = getEnv("PRESCRIBE_API_KEY");
  const host = getEnv("HOST");
  const kid = getEnv("PRESCRIBE_KID");

  const bundle = loadBundle(options.input);

  const token = await obtainAccessToken(host, apiKey, kid, privateKey);

  if (options.prepareOnly) {
    const {digest, timestamp} = await preparePrescription(host, token, bundle, options.urid);
    const output = {digest, timestamp};
    console.log(JSON.stringify(output, null, 2));
  } else {
    const result = await prepareAndSign(
      host,
      token,
      bundle,
      privateKey,
      options.urid,
      options.algorithm
    );
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
