#!/usr/bin/env node

import {Command} from "commander";
import {writeFileSync} from "fs";
import {generateCreatePrescriptionBundle} from "./index.js";

const BUSINESS_STATUS_CHOICES = [
  "With Pharmacy",
  "Ready to Collect",
  "Ready to Dispatch",
  "Dispatched",
  "Collected",
  "Not Dispensed"
];

function outputBundle(bundle: any, toClipboard: boolean, outputPath?: string): void {
  const serialized = JSON.stringify(bundle, null, 2);

  if (toClipboard) {
    // Note: clipboard functionality requires a clipboard package
    // For now, we'll just print a message
    console.error("Clipboard functionality not yet implemented. Use -o to save to file or omit for stdout.");
    process.exit(1);
  } else if (outputPath) {
    writeFileSync(outputPath, serialized, 'utf-8');
    console.error(`Bundle saved to ${outputPath}`);
  } else {
    console.log(serialized);
  }
}

function main(): void {
  const program = new Command();

  program
    .name("generate-psu-request")
    .description("Generate a FHIR Bundle with a Task resource for a prescription status update.")
    .requiredOption(
      "--business-status <status>",
      `One of: ${BUSINESS_STATUS_CHOICES.join(" | ")} (case-insensitive)`
    )
    .option(
      "--order-number <number>",
      "Prescription order number (e.g. 9A822C-A83008-13DCAB)"
    )
    .option(
      "--order-item-number <uuid>",
      "Prescription order item number (UUID)"
    )
    .option(
      "--nhs-number <number>",
      "Patient NHS number (9 digits plus check digit, e.g. 9998481732)"
    )
    .option(
      "--ods-code <code>",
      "ODS organization code (e.g. FA565)"
    )
    .option(
      "--last-modified <timestamp>",
      "Override lastModified timestamp (ISO-8601 UTC, defaults to now)"
    )
    .option(
      "--post-dated <hours>",
      "The number of hours to post-date this prescription by",
      parseFloat
    )
    .option(
      "--num-entries <count>",
      "Number of Task entries to generate (default: 1)",
      parseInt,
      1
    )
    .option(
      "-c, --clipboard",
      "Copy the generated bundle to clipboard instead of printing"
    )
    .option(
      "-o, --output <file>",
      "File path to save the bundle; prints to STDOUT if omitted"
    );

  program.parse();

  const options = program.opts();

  const bundle = generateCreatePrescriptionBundle({
    businessStatus: options.businessStatus,
    orderNumber: options.orderNumber,
    orderItemNumber: options.orderItemNumber,
    nhsNumber: options.nhsNumber,
    odsCode: options.odsCode,
    lastModified: options.lastModified,
    postDatedHours: options.postDated,
    numEntries: options.numEntries
  });

  outputBundle(bundle, options.clipboard ?? false, options.output);
}

main();
