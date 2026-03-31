#!/usr/bin/env node

import {Command} from "commander";
import {generatePrescriptionIds} from "./index.js";

function main(): void {
  const program = new Command();

  program
    .name("generate-prescription-ids")
    .description("Generate prescription IDs with optional ODS controls.")
    .option(
      "-n, --count <number>",
      "Generate a list of prescription IDs of length N",
      "1"
    )
    .option(
      "--ods <code>",
      "Use a specific ODS code for all generated IDs"
    )

  program.parse();

  const options = program.opts();
  const count = Number.parseInt(options.count, 10);

  if (Number.isNaN(count) || count < 1) {
    console.error("Error: count must be a positive integer.");
    process.exit(1);
  }

  try {
    const ids = generatePrescriptionIds(count, options.ods);
    ids.forEach(id => console.log(id));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
