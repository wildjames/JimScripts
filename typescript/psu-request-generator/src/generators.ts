import {randomUUID} from "crypto";
const PRESCRIPTION_ID_CHECK_DIGIT_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+";
const NHS_NUMBER_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2];

export function calculateCheckDigit(nineDigits: string): number {
  if (nineDigits.length !== 9 || !/^\d{9}$/.test(nineDigits)) {
    throw new Error(`Input must be exactly 9 digits. Got ${nineDigits.length}`);
  }

  const total = nineDigits
    .split("")
    .map((digit, index) => parseInt(digit, 10) * NHS_NUMBER_WEIGHTS[index])
    .reduce((sum, value) => sum + value, 0);

  const remainder = total % 11;
  const result = 11 - remainder;

  if (result === 11) {
    return 0;
  }
  if (result === 10) {
    throw new Error("Invalid NHS number sequence (check digit would be 10).");
  }
  return result;
}

export function completeNhsNumber(nineDigits: string, invalid = false): string {
  const checkDigit = calculateCheckDigit(nineDigits);
  if (!invalid) {
    return `${nineDigits}${checkDigit}`;
  }

  const choices = Array.from({length: 10}, (_, idx) => idx).filter(
    (digit) => digit !== checkDigit
  );
  const selected = choices[Math.floor(Math.random() * choices.length)];
  return `${nineDigits}${selected}`;
}

export function generateNhsNumber(options?: {invalid?: boolean; dummy?: boolean}): string {
  const invalid = options?.invalid ?? false;
  const dummy = options?.dummy ?? false;

  while (true) {
    const nineDigits = dummy
      ? `999${Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join("")}`
      : Array.from({length: 9}, () => Math.floor(Math.random() * 10)).join("");

    try {
      return completeNhsNumber(nineDigits, invalid);
    } catch {
      continue;
    }
  }
}

export function generateOdsCode(length = 5): string {
  if (length < 3 || length > 6) {
    throw new Error("ODS code length must be between 3 and 5 characters.");
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  if (length === 3) {
    return `${letters[randIndex(letters.length)]}${letters[randIndex(letters.length)]}${digits[randIndex(digits.length)]}`;
  }
  if (length === 4) {
    return `${letters[randIndex(letters.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}`;
  }
  if (length === 5) {
    return `${letters[randIndex(letters.length)]}${letters[randIndex(letters.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}`;
  }
  if (length === 6) {
    return `${letters[randIndex(letters.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}${digits[randIndex(digits.length)]}`;
  }
  throw new Error("ODS code length must be between 3 and 5 characters.");
}

export function generatePrescriptionId(odsCode?: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const core = Array.from({length: 11}, () => chars[randIndex(chars.length)]).join("");
  const ods = odsCode ?? generateOdsCode(6);

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
