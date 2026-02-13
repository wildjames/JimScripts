/**
 * NHS Number Generation and Validation
 *
 * Based on NHS Data Dictionary specification:
 * https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html
 */

// Multipliers for the first 9 digits (10, 9, 8, ..., 2)
const NHS_NUMBER_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calculate the check digit for the first nine digits of an NHS number.
 *
 * @param nineDigits - A string of 9 numeric characters
 * @returns The check digit (0-9)
 * @throws Error if the input is invalid or the computed check digit is 10
 */
export function calculateCheckDigit(nineDigits: string): number {
  if (nineDigits.length !== 9 || !/^\d{9}$/.test(nineDigits)) {
    throw new Error(`Input must be exactly 9 digits. Got ${nineDigits.length}`);
  }

  const total = nineDigits
    .split('')
    .reduce((sum, digit, index) => sum + parseInt(digit, 10) * NHS_NUMBER_WEIGHTS[index], 0);

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

/**
 * Return a complete NHS number by appending the correct or incorrect check digit.
 *
 * @param nineDigits - A string of 9 numeric characters
 * @param invalid - If true, append an incorrect check digit
 * @returns A 10-digit NHS number
 */
export function completeNhsNumber(nineDigits: string, invalid: boolean = false): string {
  const checkDigit = calculateCheckDigit(nineDigits);

  if (invalid) {
    // Pick a digit (0-9) that isn't the correct one
    const choices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => d !== checkDigit);
    const wrongDigit = choices[Math.floor(Math.random() * choices.length)];
    return nineDigits + wrongDigit.toString();
  }

  return nineDigits + checkDigit.toString();
}

/**
 * Generate a single NHS number.
 *
 * @param invalid - If true, generate a number with an incorrect check digit
 * @param dummy - If true, the number starts with '999' (dummy range)
 * @returns A 10-digit NHS number
 */
export function generateNhsNumber(invalid: boolean = false, dummy: boolean = true): string {
  let nineDigits: string;

  if (dummy) {
    const prefix = '999';
    const body = Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join('');
    nineDigits = prefix + body;
  } else {
    nineDigits = Array.from({length: 9}, () => Math.floor(Math.random() * 10)).join('');
  }

  try {
    return completeNhsNumber(nineDigits, invalid);
  } catch {
    // If this is not a valid number sequence, try again
    return generateNhsNumber(invalid, dummy);
  }
}

/**
 * Generate a list of NHS numbers.
 *
 * @param count - How many numbers to generate
 * @param invalid - If true, generate numbers with incorrect check digits
 * @param dummy - If true, numbers start with '999' (dummy range)
 * @returns An array of NHS numbers
 */
export function generateNhsNumbers(
  count: number,
  invalid: boolean = false,
  dummy: boolean = true
): string[] {
  const numbers: string[] = [];

  while (numbers.length < count) {
    try {
      const nhsNumber = generateNhsNumber(invalid, dummy);
      numbers.push(nhsNumber);
    } catch {
      // Skip invalid base sequences and retry
      continue;
    }
  }

  return numbers;
}

/**
 * Validate an NHS number by checking its format and check digit.
 *
 * @param nhsNumber - The NHS number to validate
 * @returns True if valid, false otherwise
 */
export function validateNhsNumber(nhsNumber: string): boolean {
  if (nhsNumber.length !== 10 || !/^\d{10}$/.test(nhsNumber)) {
    return false;
  }

  try {
    const expectedCheckDigit = calculateCheckDigit(nhsNumber.substring(0, 9));
    return expectedCheckDigit === parseInt(nhsNumber[9], 10);
  } catch {
    return false;
  }
}
