# Prescription Action Bundle Creator

Create FHIR prescription action bundles from an existing prescription creation bundle.

This TypeScript package provides both a CLI tool and a programmatic API for generating action bundles for prescription workflow actions.

## Current Action Support

The package recognises these actions:
- `cancel`
- `claim`
- `release`
- `dispense`

Only `cancel` is currently implemented. The other actions are parsed but return a "not yet supported" error.

## Installation

```bash
npm install
npm run build
```

## Usage

### As a CLI tool

```bash
prescription-action --action cancel --input ./data/prescriptions/prescription-bundle_20260219140421_nhs-num-9993916412.json
```

**Options:**
- `--action <action>` - One of `cancel | claim | release | dispense`
- `--input <file>` - Input prescription creation bundle JSON
- `--save-dir <directory>` - Directory to save output bundle JSON (default: `./data/prescriptions`)
- `-h, --help` - Display help

**Example:**

```bash
prescription-action \
  --action cancel \
  --input ./data/prescriptions/prescription-bundle_20260219140421_nhs-num-9993916412.json \
  --save-dir ./data/prescriptions
```

### As a library

```typescript
import {createPrescriptionActionBundle} from "prescription-action";

const cancellationBundle = createPrescriptionActionBundle({
  action: "cancel",
  inputBundle: createBundleJson
});
```

## What `cancel` currently changes

For each cancellation bundle generated from the input create bundle, this package:
- Generates a new Bundle `identifier.value` UUID
- Updates `MessageHeader.eventCoding` to `prescription-order-update`
- Clears `MessageHeader.focus`
- Sets each `MedicationRequest.status` to `cancelled`
- Adds `MedicationRequest.statusReason` with code `0001` (Prescribing Error)

## License

MIT
