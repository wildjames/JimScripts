/**
 * Prescription ID Generation
 *
 * Mirrors the Python implementation in python/utils/data_generators.py
 * Format: [6 alphanumeric]-[ODS]-[5 alphanumeric][check digit]
 */

const PRESCRIPTION_ID_CHECK_DIGIT_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+";
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomChoice(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * Generate a random ODS code of specified length.
 *
 * @param length - Length of the ODS code (3-6 characters)
 */
export function generateOdsCode(length: number = 6): string {
  if (length < 3 || length > 6) {
    throw new Error("ODS code length must be between 3 and 6 characters.");
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  if (length === 3) {
    return randomChoice(letters) + randomChoice(letters) + randomChoice(digits);
  }
  if (length === 4) {
    return randomChoice(letters) + Array.from({length: 3}, () => randomChoice(digits)).join("");
  }
  if (length === 5) {
    return randomChoice(letters) + randomChoice(letters) + Array.from({length: 3}, () => randomChoice(digits)).join("");
  }

  return randomChoice(letters) + Array.from({length: 5}, () => randomChoice(digits)).join("");
}

/**
 * Compute the prescription ID check digit for a formatted ID (without the final check digit).
 */
export function computePrescriptionIdCheckDigit(prescriptionId: string): string {
  let total = 0;
  const chars = prescriptionId.replace(/-/g, "");

  for (const char of chars) {
    const value = parseInt(char, 36);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid character '${char}' in prescription ID.`);
    }
    total = ((total + value) * 2) % 37;
  }

  for (let i = 0; i < PRESCRIPTION_ID_CHECK_DIGIT_VALUES.length; i += 1) {
    if ((total + i) % 37 === 1) {
      return PRESCRIPTION_ID_CHECK_DIGIT_VALUES[i];
    }
  }

  throw new Error("No valid check digit found");
}

/**
 * Generate a prescription order number in the format:
 * [6 alphanumeric]-[ODS]-[5 alphanumeric][check digit]
 */
export function generatePrescriptionId(odsCode?: string): string {
  const core = Array.from({length: 11}, () => randomChoice(ALPHANUM)).join("");
  const resolvedOds = odsCode ?? generateOdsCode(6);

  // ODS code should be trimmed or padded to 6 characters
  let paddedOds = resolvedOds;
  if (resolvedOds.length > 6) {
    paddedOds = resolvedOds.slice(0, 6);
  } else if (resolvedOds.length < 6) {
    paddedOds = resolvedOds.padEnd(6, "0");
  }

  const formatted = `${core.slice(0, 6)}-${paddedOds}-${core.slice(6)}`;
  const checkDigit = computePrescriptionIdCheckDigit(formatted);
  return formatted + checkDigit;
}

/**
 * Generate a list of prescription IDs.
 */
export function generatePrescriptionIds(
  count: number,
  odsCode?: string,
): string[] {
  const ids: string[] = [];

  while (ids.length < count) {
    const resolvedOds = odsCode ?? generateOdsCode(6);
    ids.push(generatePrescriptionId(resolvedOds));
  }

  return ids;
}
