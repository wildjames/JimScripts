#!/usr/bin/env node

import {Command} from "commander";
import {generateOdsCodes} from "./ods.js";
import {generateOrganization} from "./organization.js";
import {generatePractitionerRole} from "./practitioner-role.js";

function main(): void {
  const program = new Command();

  program
    .name("generate-ods-codes")
    .description("Generate test data: ODS codes, FHIR Organizations, PractitionerRoles")
    .option(
      "-t, --type <type>",
      "Data type to generate: ods, organization, practitioner-role"
    )
    .option(
      "-n, --count <number>",
      "How many items to generate",
      "1"
    )
    .option(
      "-l, --length <number>",
      "Length of each ODS code (3-6 characters, ods type only)",
      "6"
    )
    .option(
      "--ods <code>",
      "Use a specific ODS code (organization type only)"
    );

  program.parse();

  const options = program.opts();
  const count = Number.parseInt(options.count, 10);
  const type = options.type as string;

  if (Number.isNaN(count) || count < 1) {
    console.error("Error: count must be a positive integer.");
    process.exit(1);
  }

  switch (type) {
    case "ods": {
      const length = Number.parseInt(options.length, 10);
      if (Number.isNaN(length) || length < 3 || length > 6) {
        console.error("Error: length must be between 3 and 6.");
        process.exit(1);
      }
      const codes = generateOdsCodes(count, length);
      codes.forEach(code => console.log(code));
      break;
    }
    case "organization": {
      for (let i = 0; i < count; i++) {
        console.log(JSON.stringify(generateOrganization(options.ods), null, 2));
      }
      break;
    }
    case "practitioner-role": {
      for (let i = 0; i < count; i++) {
        console.log(JSON.stringify(generatePractitionerRole(), null, 2));
      }
      break;
    }
    default:
      console.error(`Unknown type '${type}'. Valid types: ods, organization, practitioner-role`);
      process.exit(1);
  }
}

main();
