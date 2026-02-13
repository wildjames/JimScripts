#!/usr/bin/env node

import {Command} from "commander";
import {generateOdsCodes} from "./index.js";

function main(): void {
  const program = new Command();

  program
    .name("generate-ods-codes")
    .description("Generate ODS (Organisation Data Service) codes")
    .option(
      "-n, --count <number>",
      "Generate a list of ODS codes of length N",
      "1"
    )
    .option(
      "-l, --length <number>",
      "Length of each ODS code (3-6 characters)",
      "6"
    );

  program.parse();

  const options = program.opts();
  const count = Number.parseInt(options.count, 10);
  const length = Number.parseInt(options.length, 10);

  if (Number.isNaN(count) || count < 1) {
    console.error("Error: count must be a positive integer.");
    process.exit(1);
  }

  if (Number.isNaN(length) || length < 3 || length > 6) {
    console.error("Error: length must be between 3 and 6.");
    process.exit(1);
  }

  try {
    const codes = generateOdsCodes(count, length);
    codes.forEach(code => console.log(code));
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
