# generate-prescription-ids

Generates prescription order numbers in the format `<6 alphanumeric>-<ODS code padded to 6>-<5 alphanumeric><check digit>`.

**Package:** `prescription-id-generator`

## CLI Usage

```bash
generate-prescription-ids                    # One prescription ID
generate-prescription-ids -n 5               # Five prescription IDs
generate-prescription-ids --ods A12345 -n 3  # Use a fixed ODS code
generate-prescription-ids --ods-length 4     # Random ODS codes of length 4
```

## Options

| Flag                    | Description                       | Default |
| ----------------------- | --------------------------------- | ------- |
| `-n, --count <number>`  | How many IDs to generate          | 1       |
| `--ods <code>`          | Use a specific ODS code           | random  |
| `--ods-length <number>` | Length for random ODS codes (3–6) | 6       |

## Programmatic API

```typescript
import {
  generatePrescriptionId,
  generatePrescriptionIds,
  computePrescriptionIdCheckDigit,
} from "prescription-id-generator";

generatePrescriptionId(); // → "ABC123-A12345-DEF45X"
generatePrescriptionIds(5); // → string[]
computePrescriptionIdCheckDigit("ABC123-A12345-DEF45"); // → check digit char
```

## Notes

- No environment variables required.
- Output format: `XXXXXX-YYYYYY-ZZZZZC` where C is a check digit.
