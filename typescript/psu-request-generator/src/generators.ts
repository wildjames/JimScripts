import {randomUUID} from "crypto";
import {generateNhsNumber as generateNhsNumberImpl} from "nhs-number-generator";

const PRESCRIPTION_ID_CHECK_DIGIT_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+";

export function generateNhsNumber(): string {
  return generateNhsNumberImpl();
}

export function generateOdsCode(length = 6): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  // I got these from looking at some examples I found in test data. I don't think they're hard rules.
  const patterns: Record<number, string> = {
    3: "LLD", 4: "LDDD", 5: "LLDDD", 6: "LDDDDD"
  };

  function randLetter() {
    return letters[Math.floor(Math.random() * letters.length)];
  }
  function randDigit() {
    return digits[Math.floor(Math.random() * digits.length)];
  }

  const pattern = patterns[length];
  if (!pattern) {
    throw new Error("ODS code length must be between 3 and 6 characters.");
  }

  let out = "";
  for (const char of pattern) {
    switch (char) {
      case "L":
        out += randLetter();
        break;
      case "D":
        out += randDigit();
        break;
    }
  }
  return out;
}

export function generatePrescriptionId(odsCode?: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const core = Array.from({length: 11}, () => chars[randIndex(chars.length)]).join("");
  let ods = odsCode ?? generateOdsCode();
  // ODS code either needs to be padded or trimmed to be 6 characters
  if (ods.length > 6) {ods = ods.slice(0, 6);}
  else if (ods.length < 6) {ods = ods.padEnd(6, "0");}

  const formatted = `${core.slice(0, 6)}-${ods}-${core.slice(6)}`;
  const checkDigit = computePrescriptionCheckDigit(formatted);
  return `${formatted}${checkDigit}`;
}

export function computePrescriptionCheckDigit(prescriptionId: string): string {
  let total = 0;
  const chars = prescriptionId.replace(/-/g, "");

  for (const char of chars) {
    total = ((total + parseInt(char, 36)) * 2) % 37;
  }

  for (let i = 0; i < PRESCRIPTION_ID_CHECK_DIGIT_VALUES.length; i += 1) {
    if ((total + i) % 37 === 1) {
      return PRESCRIPTION_ID_CHECK_DIGIT_VALUES[i];
    }
  }

  throw new Error("No valid check digit found");
}

export function generateOrderItemNumber(): string {
  return randomUUID();
}

function randIndex(max: number): number {
  return Math.floor(Math.random() * max);
}
