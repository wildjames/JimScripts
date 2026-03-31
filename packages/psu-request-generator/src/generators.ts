import {randomUUID} from "crypto";

import {generateNhsNumber} from "nhs-number-generator";
import {generateOdsCode} from "ods-code-generator";
import {generatePrescriptionId} from "prescription-id-generator";

export {generateNhsNumber, generatePrescriptionId, generateOdsCode};

export function generateOrderItemNumber(): string {
  return randomUUID();
}
