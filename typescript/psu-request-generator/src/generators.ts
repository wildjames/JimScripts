import {randomUUID} from "crypto";
import {generateNhsNumber as generateNhsNumberImpl} from "nhs-number-generator";
import {generatePrescriptionId as generatePrescriptionIdImpl} from "prescription-id-generator";

export function generateNhsNumber(): string {
  return generateNhsNumberImpl();
}

export function generatePrescriptionId(odsCode?: string): string {
  return generatePrescriptionIdImpl(odsCode);
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

export function generateOrderItemNumber(): string {
  return randomUUID();
}
