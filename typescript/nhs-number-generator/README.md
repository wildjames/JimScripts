# NHS Number Generator

A TypeScript command-line tool for generating and validating NHS numbers based on the [NHS Data Dictionary specification](https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/attributes/nhs_number.html).

## Installation

```bash
npm install
npm run build
sudo npm link
```

Or use the Makefile from the repository root:

```bash
make link
```

## Usage

### Generate NHS Numbers

Generate a single dummy NHS number (starts with '999'):
```bash
generate-nhs-numbers
```

Generate multiple NHS numbers:
```bash
generate-nhs-numbers -n 5
```

Generate real (non-dummy) NHS numbers:
```bash
generate-nhs-numbers --real -n 3
```

Generate invalid NHS numbers (incorrect check digit):
```bash
generate-nhs-numbers --invalid -n 2
```

### Complete a 9-Digit NHS Number

Compute and append the check digit for a 9-digit NHS number:
```bash
generate-nhs-numbers -c 999123456
```

Generate with an incorrect check digit:
```bash
generate-nhs-numbers -c 999123456 --invalid
```

## Options

- `-n, --count <number>` - Generate a list of NHS numbers of length N (default: 1)
- `-c, --complete <9_digits>` - Generate the full NHS number by computing the check digit for a 9-digit input
- `--real` - Generate non-dummy NHS numbers (not restricted to the '999' prefix range)
- `--invalid` - Produce NHS numbers with incorrect check digits

## API

You can also use this package programmatically:

```typescript
import {
  generateNhsNumber,
  generateNhsNumbers,
  completeNhsNumber,
  validateNhsNumber,
  calculateCheckDigit
} from 'nhs-number-generator';

// Generate a single NHS number
const nhsNumber = generateNhsNumber();

// Generate multiple NHS numbers
const numbers = generateNhsNumbers(5);

// Complete a 9-digit NHS number
const complete = completeNhsNumber('999123456');

// Validate an NHS number
const isValid = validateNhsNumber('9999123456');

// Calculate check digit
const checkDigit = calculateCheckDigit('999123456');
```

## NHS Number Format

An NHS number is a 10-digit number where:
- The first 9 digits are the identifier
- The 10th digit is a check digit calculated using the Modulus 11 algorithm

Dummy NHS numbers (for testing) conventionally start with '999'.
