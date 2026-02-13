/**
 * ODS Code Generation
 *
 * Generate ODS (Organisation Data Service) codes following common patterns.
 * Based on observed patterns in test data - not necessarily hard NHS rules.
 */

/**
 * Generate a random ODS code of specified length.
 *
 * @param length - Length of the ODS code (3-6 characters)
 * @returns A randomly generated ODS code
 * @throws Error if length is not between 3 and 6
 */
export function generateOdsCode(length = 6): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  // Patterns observed from test data - not necessarily hard rules
  const patterns: Record<number, string> = {
    3: "LLD",
    4: "LDDD",
    5: "LLDDD",
    6: "LDDDDD"
  };

  function randLetter(): string {
    return letters[Math.floor(Math.random() * letters.length)];
  }

  function randDigit(): string {
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

/**
 * Generate multiple ODS codes.
 *
 * @param count - Number of ODS codes to generate
 * @param length - Length of each ODS code (3-6 characters)
 * @returns Array of ODS codes
 */
export function generateOdsCodes(count: number, length = 6): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateOdsCode(length));
  }
  return codes;
}
