#!/usr/bin/env node

import {Command} from "commander";
import {writeFileSync, mkdirSync, existsSync} from "fs";
import {join} from "path";
import {createPrescriptionMessageBundle} from "./prescription.js";

function findNhsNumber(bundle: any): string {
  // This is probably not robust enough - but it will work for now. If it ever fails, I'll have to rework it
  // Look through entries to find NHS number
  for (const entry of bundle.entry || []) {
    const resource = entry.resource;

    // Check MedicationRequest subject identifier
    if (resource.resourceType === "MedicationRequest") {
      const subjectIdentifier = resource.subject?.identifier?.[0]?.value;
      if (subjectIdentifier) return subjectIdentifier;
    }

    // Check Patient identifier
    if (resource.resourceType === "Patient") {
      const patientIdentifier = resource.identifier?.[0]?.value;
      if (patientIdentifier) return patientIdentifier;
    }
  }

  return "unknown-nhs-number";
}

function saveBundle(prefix: string, bundle: any, saveDir: string): void {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, {recursive: true});
  }

  const nhsNumber = findNhsNumber(bundle);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').split('-').slice(0, 6).join('');

  const fileName = `${prefix}_${timestamp}_nhs-num-${nhsNumber}.json`;
  const filePath = join(saveDir, fileName);

  writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf-8');
  console.log(filePath);
}

function main(): void {
  const program = new Command();

  program
    .name("fhir-create-prescription-bundle")
    .description("Generate a FHIR JSON message for a create prescription order message.")
    .option(
      "--nhs-number <number>",
      "Patient's NHS number (generated if not provided)"
    )
    .option(
      "--pharmacy-ods <code>",
      "Pharmacy ODS organization code (generated if not provided)"
    )
    .option(
      "--practitioner-ods <code>",
      "Practitioner ODS organization code (generated if not provided)"
    )
    .option(
      "-n, --count <number>",
      "Number of prescriptions to create (defaults to 1)",
      (val) => parseInt(val, 10),
      1
    )
    .option(
      "--save-dir <directory>",
      "Directory to save the generated FHIR Bundle JSON",
      "./data/prescriptions"
    );

  program.parse();

  const options = program.opts();

  const bundle = createPrescriptionMessageBundle({
    nhsNumber: options.nhsNumber,
    count: options.count,
    pharmacyOds: options.pharmacyOds,
    practitionerOds: options.practitionerOds
  });

  saveBundle("prescription-bundle", bundle, options.saveDir);
}

main();
