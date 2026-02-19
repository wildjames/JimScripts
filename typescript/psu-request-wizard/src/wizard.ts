import {readFileSync} from "fs";
import {randomUUID} from "crypto";
import {createInterface} from "readline/promises";
import {stdin as input, stdout as output} from "process";

import {config} from "dotenv";
import {validateNhsNumber} from "nhs-number-generator";
import {fetchBundle, getPfpEnv, saveBundle} from "pfp-request-sender";
import {
  BUSINESS_STATUS_CHOICES,
  buildPsuBundle,
  buildPsuEntry,
  canonicalBusinessStatus,
  generateCreatePrescriptionBundle,
  type PsuEntry
} from "psu-request-generator";
import {getEnv, loadPrivateKey, obtainAccessToken, sendPsu} from "psu-request-sender";

import {
  extractMedicationSummary,
  findDispensePerformerOds,
  isoNow,
  medicationRequestsFromPfp,
  outputBundle
} from "./utils.js";

type AnyRecord = Record<string, unknown>;

export interface WizardOptions {
  wizard: boolean;
  input?: string;
  nhsNumber?: string;
  odsCode?: string;
  businessStatus: string;
  clipboard: boolean;
  output?: string;
  send: boolean;
  saveDir: string;
}

function requireField(value: string, fieldName: string): string {
  if (!value) {
    throw new Error(`Missing required value for ${fieldName}`);
  }
  return value;
}

async function promptBusinessStatus(rl: ReturnType<typeof createInterface>): Promise<string> {
  console.log("Select a new businessStatus:");
  BUSINESS_STATUS_CHOICES.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice}`);
  });

  const raw = (await rl.question("Enter number or exact text: ")).trim();

  if (/^\d+$/.test(raw)) {
    const idx = Number.parseInt(raw, 10);
    if (idx >= 1 && idx <= BUSINESS_STATUS_CHOICES.length) {
      return BUSINESS_STATUS_CHOICES[idx - 1];
    }
  }

  return canonicalBusinessStatus(raw);
}

async function selectMedication(
  body: AnyRecord,
  rl: ReturnType<typeof createInterface>
): Promise<AnyRecord | null> {
  const meds = medicationRequestsFromPfp(body);
  if (meds.length === 0) {
    throw new Error("No MedicationRequest entries found.");
  }

  console.log("Medications in fetched bundle:");
  console.log("   #        Status | NPPTS Status                               | Order Number          | Item Number                           | Medication");
  meds.forEach((medication, idx) => {
    const summary = extractMedicationSummary(medication);
    console.log(
      `  ${String(idx + 1).padStart(2, " ")}. ${summary.status.padStart(12, " ")} | ${summary.npptStatus.padEnd(40, " ")}\t| ${summary.orderNumber}\t| ${summary.itemNumber}\t| ${summary.medicationName}`
    );
  });

  const choice = (await rl.question(`Choose an entry to update [1-${meds.length}]: `)).trim();
  const selected = Number.parseInt(choice, 10);
  if (Number.isNaN(selected) || selected < 1 || selected > meds.length) {
    return null;
  }

  return meds[selected - 1];
}

async function sendBundle(bundle: Record<string, unknown>): Promise<void> {
  config();

  const host = getEnv("HOST");
  const apiKey = getEnv("API_KEY");
  const kid = getEnv("KID");
  const privateKey = loadPrivateKey();
  const isPr = getEnv("IS_PR").trim().toLowerCase() === "true";

  let token = "";
  if (!isPr) {
    console.log("Getting access token...");
    token = await obtainAccessToken(host, apiKey, kid, privateKey);
  }

  console.log("Sending PSU bundle...");
  const {response, requestId, correlationId} = await sendPsu(host, token, bundle);

  console.log(`Request ID: ${requestId}`);
  console.log(`Correlation ID: ${correlationId}`);
  console.log(`Response: ${response.status} ${response.statusText}`);

  if (response.status !== 201) {
    const bodyText = await response.text();
    try {
      console.log(JSON.stringify(JSON.parse(bodyText), null, 2));
    } catch {
      console.log(bodyText);
    }
    throw new Error("Failed to send bundle");
  }
}

export async function runWizard(args: WizardOptions): Promise<void> {
  let bundle: Record<string, unknown> | null = null;
  let data: AnyRecord = {};

  if (args.input) {
    data = JSON.parse(readFileSync(args.input, "utf-8")) as AnyRecord;
  } else if (args.wizard) {
    const rl = createInterface({input, output});
    const countRaw = (await rl.question("How many prescriptions to create? ")).trim();

    const count = Number.parseInt(countRaw, 10);
    if (Number.isNaN(count) || count < 1) {
      rl.close();
      throw new Error("Prescription count must be a positive integer.");
    }

    if (count > 1) {
      bundle = generateCreatePrescriptionBundle({
        businessStatus: args.businessStatus,
        numEntries: count,
        odsCode: args.odsCode
      }) as unknown as Record<string, unknown>;
    } else {
      const fromArg = args.nhsNumber?.trim();
      const nhsNumber = fromArg || (await rl.question("Enter NHS number to use in the request: ")).trim();
      if (!nhsNumber || !validateNhsNumber(nhsNumber)) {
        rl.close();
        throw new Error("NHS number is required (and must be valid) in wizard mode.");
      }

      bundle = generateCreatePrescriptionBundle({
        businessStatus: args.businessStatus,
        odsCode: args.odsCode,
        nhsNumber,
        numEntries: 1
      }) as unknown as Record<string, unknown>;
    }

    rl.close();
  } else if (args.nhsNumber) {
    const {host, clientId, clientSecret, redirectUri} = getPfpEnv();
    data = (await fetchBundle(
      host,
      clientId,
      clientSecret,
      redirectUri,
      args.nhsNumber
    )) as AnyRecord;
  } else {
    throw new Error("Either --input or --nhs-number must be provided.");
  }

  if (!bundle) {
    const entries: PsuEntry[] = [];
    const rl = createInterface({input, output});

    while (true) {
      const chosen = await selectMedication(data, rl);
      if (!chosen) {
        break;
      }

      const summary = extractMedicationSummary(chosen);
      const orderNum = requireField(summary.orderNumber, "order number");
      const itemNum = requireField(summary.itemNumber, "order item number");
      const nhsNum = requireField(summary.nhsNumber, "NHS number");

      const defaultOds = findDispensePerformerOds(data, chosen);
      const odsRaw = (await rl.question(`ODS organization code [${defaultOds}]: `)).trim();
      const ods = odsRaw || defaultOds;
      const businessStatus = await promptBusinessStatus(rl);
      const lm = (await rl.question("LastModified timestamp [enter for now]: ")).trim() || isoNow();

      const entry = buildPsuEntry({
        businessStatus,
        orderNumber: orderNum,
        orderItemNumber: itemNum,
        nhsNumber: nhsNum,
        odsCode: ods,
        lastModified: lm,
        taskId: randomUUID()
      });

      entries.push(entry);
    }

    rl.close();
    bundle = buildPsuBundle(entries) as unknown as Record<string, unknown>;
  }

  saveBundle("psu-request", bundle, args.saveDir);

  if (args.send) {
    await sendBundle(bundle);
  } else {
    outputBundle(bundle, args.clipboard, args.output);
  }
}
