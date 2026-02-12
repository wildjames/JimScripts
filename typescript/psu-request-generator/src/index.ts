import {randomUUID} from "crypto";

import {
  buildPsuBundle,
  buildPsuEntry,
  type Bundle,
  type BusinessStatus,
  type PsuEntry
} from "./psu.js";
import {
  generateNhsNumber,
  generateOdsCode,
  generateOrderItemNumber,
  generatePrescriptionId
} from "./generators.js";

export interface GenerateCreatePrescriptionBundleOptions {
  businessStatus: string;
  orderNumber?: string;
  orderItemNumber?: string;
  nhsNumber?: string;
  odsCode?: string;
  lastModified?: string;
  postDatedHours?: number;
  numEntries?: number;
}

export function generateCreatePrescriptionBundle(
  options: GenerateCreatePrescriptionBundleOptions
): Bundle {
  const numEntries = options.numEntries ?? 1;
  const entries: PsuEntry[] = [];

  for (let i = 0; i < numEntries; i += 1) {
    const odsCode = options.odsCode ?? generateOdsCode();
    const orderNumber = options.orderNumber ?? generatePrescriptionId(odsCode);
    const orderItemNumber = options.orderItemNumber ?? generateOrderItemNumber();
    const nhsNumber = options.nhsNumber ?? generateNhsNumber();

    let lastModified = options.lastModified;
    let postDatedTimestamp: string | null = null;

    if (options.postDatedHours) {
      const now = Date.now();
      lastModified = new Date(now + options.postDatedHours * 3600 * 1000).toISOString();
      postDatedTimestamp = new Date(now).toISOString();
    }

    const entry = buildPsuEntry({
      businessStatus: options.businessStatus,
      orderNumber,
      orderItemNumber,
      nhsNumber,
      odsCode,
      lastModified,
      postDatedTimestamp,
      taskId: randomUUID()
    });

    entries.push(entry);
  }

  return buildPsuBundle(entries);
}

export type {Bundle, BusinessStatus};
