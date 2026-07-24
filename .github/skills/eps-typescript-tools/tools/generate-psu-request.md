# generate-psu-request

Generates FHIR Bundle resources containing Task entries for Prescription Status Updates.

**Package:** `psu-request-generator`

## CLI Usage

```bash
generate-psu-request --business-status "With Pharmacy"
generate-psu-request --business-status "Ready to Collect" --nhs-number 9998481732 -o output.json
generate-psu-request --business-status "Dispatched" --post-dated 24 -o post-dated.json
generate-psu-request --business-status "Collected" --num-entries 5 -o multi.json
generate-psu-request --business-status "Not Dispensed" --ods-code FA565 --order-number 9A822C-A83008-13DCAB
generate-psu-request --business-status "With Pharmacy" | jq '.entry[0].resource'
```

## Options

| Flag                          | Description                            | Default        |
| ----------------------------- | -------------------------------------- | -------------- |
| `--business-status <status>`  | **Required.** See valid statuses below | —              |
| `--order-number <number>`     | Prescription order number              | auto-generated |
| `--order-item-number <uuid>`  | Prescription order item number (UUID)  | auto-generated |
| `--nhs-number <number>`       | Patient NHS number                     | auto-generated |
| `--ods-code <code>`           | ODS organisation code                  | auto-generated |
| `--last-modified <timestamp>` | ISO-8601 UTC timestamp                 | current time   |
| `--post-dated <hours>`        | Hours to post-date the prescription    | —              |
| `--num-entries <count>`       | Number of Task entries in the bundle   | 1              |
| `-o, --output <file>`         | Output file path                       | STDOUT         |

## Valid Business Statuses

- `With Pharmacy`
- `Ready to Collect`
- `Ready to Dispatch`
- `Dispatched`
- `Collected`
- `Not Dispensed`

## Programmatic API

```typescript
import { generateCreatePrescriptionBundle } from "psu-request-generator";

const bundle = generateCreatePrescriptionBundle({
  businessStatus: "With Pharmacy",
  nhsNumber: "9998481732",
  numEntries: 1,
});
```

## Notes

- No environment variables required.
- Output is a FHIR Bundle with Task entries suitable for sending via `send-psu-request`.
