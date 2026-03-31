# PSU Request Generator

Generate FHIR Bundle resources with Task entries for prescription status updates (PSU).

## Installation

```bash
npm install
npm run build
```

### Global Installation

To use the CLI tool globally:

```bash
npm link
```

This makes the `generate-psu-request` command available system-wide. You may need to run as `sudo`.

## Usage

### As a CLI Tool

```bash
# After npm link
generate-psu-request --business-status "With Pharmacy"

# Or directly with node
node dist/cli.js --business-status "With Pharmacy"
```

### As a Library

```typescript
import { generateCreatePrescriptionBundle } from 'psu-request-generator';

const bundle = generateCreatePrescriptionBundle({
  businessStatus: "With Pharmacy",
  nhsNumber: "9998481732",
  numEntries: 1
});
```

## CLI Options

### Required

- `--business-status <status>` - The prescription status. Must be one of:
  - `With Pharmacy`
  - `Ready to Collect`
  - `Ready to Dispatch`
  - `Dispatched`
  - `Collected`
  - `Not Dispensed`

### Optional

- `--order-number <number>` - Prescription order number (e.g. `9A822C-A83008-13DCAB`). Auto-generated if not provided.
- `--order-item-number <uuid>` - Prescription order item number (UUID). Auto-generated if not provided.
- `--nhs-number <number>` - Patient NHS number (10 digits including check digit, e.g. `9998481732`). Auto-generated if not provided.
- `--ods-code <code>` - ODS organization code (e.g. `FA565`). Auto-generated if not provided.
- `--last-modified <timestamp>` - Override lastModified timestamp (ISO-8601 UTC format). Defaults to current time.
- `--post-dated <hours>` - Number of hours to post-date the prescription by. When set, `lastModified` becomes the future time and a post-dated timestamp is added.
- `--num-entries <count>` - Number of Task entries to generate in the bundle (default: 1).
- `-o, --output <file>` - Save the bundle to a file. If omitted, prints to STDOUT.
- `-c, --clipboard` - Copy to clipboard (not yet implemented).
- `-h, --help` - Display help information.

## Examples

### Generate a basic PSU request

```bash
generate-psu-request --business-status "With Pharmacy"
```

Output is printed to STDOUT as JSON.

### Generate with specific NHS number and save to file

```bash
generate-psu-request \
  --business-status "Ready to Collect" \
  --nhs-number 9998481732 \
  -o output.json
```

### Generate a post-dated prescription

```bash
generate-psu-request \
  --business-status "Dispatched" \
  --post-dated 24 \
  -o post-dated-prescription.json
```

This creates a prescription that becomes active 24 hours from now.

### Generate multiple entries in one bundle

```bash
generate-psu-request \
  --business-status "Collected" \
  --num-entries 5 \
  -o multi-entry-bundle.json
```

### Use with specific ODS code and prescription ID

```bash
generate-psu-request \
  --business-status "Not Dispensed" \
  --ods-code FA565 \
  --order-number 9A822C-A83008-13DCAB \
  --nhs-number 9998481732
```

### Pipe output to other tools

```bash
generate-psu-request --business-status "With Pharmacy" | jq '.entry[0].resource'
```

## Development

### Build

```bash
npm run build
```

Compiles TypeScript files from `src/` to `dist/`.

### Project Structure

```
src/
  ├── cli.ts           # CLI entry point
  ├── index.ts         # Main library exports
  ├── psu.ts           # PSU bundle/entry builders
  └── generators.ts    # Data generators (NHS numbers, ODS codes, etc.)
```

## Output Format

The tool generates a FHIR Bundle resource with Task entries following the NHS Digital prescription tracking specification. Each Task includes:

- `basedOn` - Reference to the prescription order number
- `businessStatus` - The status code (e.g., "With Pharmacy")
- `focus` - Reference to the prescription order item number
- `for` - Patient reference with NHS number
- `owner` - Dispensing organization ODS code
- `lastModified` - Timestamp of the status update

## License

See repository root for license information.
