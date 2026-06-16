import {randomUUID} from "crypto";

import {generateNhsNumber} from "nhs-number-utils";
import {generateOdsCode} from "data-generators";
import {generatePrescriptionId} from "prescription-id-generator";

export {generateNhsNumber, generatePrescriptionId, generateOdsCode};

export function generateOrderItemNumber(): string {
  return randomUUID();
}
