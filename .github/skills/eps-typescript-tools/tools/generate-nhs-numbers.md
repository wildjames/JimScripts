# generate-nhs-numbers

Generates valid (or intentionally invalid) 10-digit NHS numbers following the Modulus 11 check digit algorithm.

**Package:** `nhs-number-generator`

## CLI Usage

```bash
generate-nhs-numbers                    # One dummy NHS number (999 prefix)
generate-nhs-numbers -n 5               # Five dummy NHS numbers
generate-nhs-numbers --real -n 3        # Non-dummy NHS numbers (no 999 prefix restriction)
generate-nhs-numbers --invalid -n 2     # Numbers with incorrect check digits
generate-nhs-numbers -c 999123456       # Complete a 9-digit number with its check digit
generate-nhs-numbers -c 999123456 --invalid  # Complete with an incorrect check digit
```

## Options

| Flag                        | Description                             | Default            |
| --------------------------- | --------------------------------------- | ------------------ |
| `-n, --count <number>`      | How many to generate                    | 1                  |
| `-c, --complete <9_digits>` | Compute check digit for a 9-digit input | —                  |
| `--real`                    | Allow non-dummy prefixes                | false (999 prefix) |
| `--invalid`                 | Produce incorrect check digits          | false              |

## Programmatic API

```typescript
import {
  generateNhsNumber,
  generateNhsNumbers,
  completeNhsNumber,
  validateNhsNumber,
  calculateCheckDigit,
} from "nhs-number-generator";

generateNhsNumber(); // → "9991234560"
generateNhsNumbers(5); // → string[]
completeNhsNumber("999123456"); // → "9991234560"
validateNhsNumber("9991234560"); // → true | false
calculateCheckDigit("999123456"); // → number
```

## Notes

- Test/dummy NHS numbers use the `999` prefix.
- The 10th digit is a Modulus 11 check digit.
- No environment variables required.
