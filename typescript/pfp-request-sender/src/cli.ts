#!/usr/bin/env node

import {Command} from "commander";
import {config} from "dotenv";

import {fetchBundle, getPfpEnv} from "./pfp.js";
import {saveBundle} from "./utils.js";

async function main(): Promise<void> {
  config();

  const program = new Command();
  program
    .name("send-pfp-request")
    .description(
      "Fetch PfP Bundle for a given NHS number (using OAuth2 auth-code flow)"
    )
    .argument("<nhs_number>", "10-digit NHS number to query")
    .option(
      "--save-dir <dir>",
      "Directory to save the generated FHIR Bundle JSON",
      "./data/pfp_responses"
    );

  program.parse();

  const nhsNumber = program.args[0];
  if (nhsNumber === "5839945242") {
    throw new Error("Do not use this NHS number - it will crash Veit07!");
  }

  const options = program.opts<{saveDir: string}>();
  const {host, clientId, clientSecret, redirectUri} = getPfpEnv();

  const bundle = await fetchBundle(
    host,
    clientId,
    clientSecret,
    redirectUri,
    nhsNumber
  );

  saveBundle("pfp_response", bundle, options.saveDir, nhsNumber);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
