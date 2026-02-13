#!/usr/bin/env node

import {Command} from "commander";
import {generateNhsNumbers, completeNhsNumber} from "./index.js";

function main(): void {
  const program = new Command();

  program
    .name("generate-nhs-numbers")
    .description("Generate or validate NHS numbers with optional invalid or dummy flags.")
    .option(
      "-n, --count <number>",
      "Generate a list of NHS numbers of length N",
      "1"
    )
    .option(
      "-c, --complete <9_digits>",
      "Generate the full NHS number by computing the check digit for a 9-digit input"
    )
    .option(
      "--real",
      "DON'T Generate a dummy NHS number (always starts with '999'), instead make one that is not restricted to the dummy range."
    )
    .option(
      "--invalid",
      "Produce NHS numbers with incorrect check digits"
    );

  program.parse();

  const options = program.opts();

  if (options.complete) {
    try {
      const nineDigits = options.complete;
      const fullNumber = completeNhsNumber(nineDigits, options.invalid ?? false);
      console.log(fullNumber);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error("An unknown error occurred");
      }
      process.exit(1);
    }
  } else {
    const count = options.count ?? 1;
    const invalid = options.invalid ?? false;
    // Note: The Python script uses --real as a store_false flag, meaning:
    // - When --real is present, dummy should be false
    // - When --real is absent, dummy should be true (default)
    const dummy = !options.real;

    const numbers = generateNhsNumbers(count, invalid, dummy);
    numbers.forEach(num => console.log(num));
  }
}

main();
