#!/usr/bin/env node

import {Command} from "commander";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import {basename, join} from "path";

import {
  createPrescriptionActionBundle,
  SUPPORTED_ACTIONS,
  type BundleLike,
  type PrescriptionAction
} from "./actions.js";

function readInputBundle(filePath: string): BundleLike {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as BundleLike;
}

function findNhsNumber(bundle: BundleLike): string {
  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;
    if (resource?.resourceType !== "Patient") {
      continue;
    }

    const identifiers = resource.identifier as Array<{value?: string}> | undefined;
    const value = identifiers?.[0]?.value;
    if (value) {
      return value;
    }
  }

  return "unknown-nhs-number";
}

function saveBundle(action: PrescriptionAction, bundle: BundleLike, saveDir: string): string {
  if (!existsSync(saveDir)) {
    mkdirSync(saveDir, {recursive: true});
  }

  const nhsNumber = findNhsNumber(bundle);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .split("-")
    .slice(0, 6)
    .join("");

  const fileName = `${action}-bundle_${timestamp}_nhs-num-${nhsNumber}.json`;
  const outputPath = join(saveDir, fileName);

  writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
  return outputPath;
}

function parseAction(action: string): PrescriptionAction {
  if (!SUPPORTED_ACTIONS.includes(action as PrescriptionAction)) {
    throw new Error(
      `Unknown action '${action}'. Allowed actions: ${SUPPORTED_ACTIONS.join(", ")}`
    );
  }

  return action as PrescriptionAction;
}

function main(): void {
  const program = new Command();

  program
    .name("prescription-action")
    .description("Create FHIR prescription action bundles from a create-prescription bundle")
    .requiredOption("--action <action>", `Action to perform (${SUPPORTED_ACTIONS.join(" | ")})`)
    .requiredOption("--input <file>", "Input create-prescription bundle JSON file")
    .option(
      "--save-dir <directory>",
      "Directory to save the generated action Bundle JSON",
      "./data/prescriptions"
    );

  program.parse();
  const options = program.opts<{action: string; input: string; saveDir: string}>();

  const action = parseAction(options.action.toLowerCase());

  if (!existsSync(options.input)) {
    throw new Error(`Input file not found: ${basename(options.input)}`);
  }

  const inputBundle = readInputBundle(options.input);
  const outputBundle = createPrescriptionActionBundle({
    action,
    inputBundle
  });

  console.log(JSON.stringify(outputBundle, null, 2));

  const outputPath = saveBundle(action, outputBundle, options.saveDir);
  console.log(outputPath);
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
