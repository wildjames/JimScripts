#!/usr/bin/env node

import {Command} from "commander";

import {runWizard} from "./wizard.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("make-psu-request")
    .description("Wizard to build a FHIR Task bundle based on a PfP response.")
    .option(
      "-w, --wizard",
      "Run the interactive wizard to create a PSU request bundle, without fetched data."
    )
    .option("-i, --input <file>", "Path to JSON file with PfP response bundle.")
    .option(
      "-n, --nhs-number <number>",
      "NHS number to use; if provided, the script will fetch the PfP bundle itself."
    )
    .option(
      "--ods-code <code>",
      "ODS organization code to use in the PSU request if using wizard mode."
    )
    .option(
      "--business-status <status>",
      "Business status to set in the PSU request if using wizard mode.",
      "With Pharmacy"
    )
    .option(
      "-c, --clipboard",
      "Copy the generated bundle to clipboard instead of printing."
    )
    .option(
      "-o, --output <file>",
      "File path to save the bundle; prints to STDOUT if omitted."
    )
    .option("-s, --send", "Send the bundle to the PSU endpoint")
    .option(
      "--save-dir <dir>",
      "Directory to save the generated FHIR Bundle JSON",
      "./data/psu_requests"
    );

  program.parse();
  const options = program.opts<{
    wizard?: boolean;
    input?: string;
    nhsNumber?: string;
    odsCode?: string;
    businessStatus: string;
    clipboard?: boolean;
    output?: string;
    send?: boolean;
    saveDir: string;
  }>();

  await runWizard({
    wizard: options.wizard ?? false,
    input: options.input,
    nhsNumber: options.nhsNumber,
    odsCode: options.odsCode,
    businessStatus: options.businessStatus,
    clipboard: options.clipboard ?? false,
    output: options.output,
    send: options.send ?? false,
    saveDir: options.saveDir
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
