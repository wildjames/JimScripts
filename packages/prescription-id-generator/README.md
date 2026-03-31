# Prescription ID Generator

A TypeScript command-line tool for generating prescription IDs. Format is based on the CPT-UI validation

## Installation

```bash
npm install
npm run build
sudo npm link
```

Or use the Makefile from the repository root:

```bash
sudo make link
```

## Usage

Generate a single prescription ID:
```bash
generate-prescription-ids
```

Generate multiple prescription IDs:
```bash
generate-prescription-ids -n 5
```

Generate using a fixed ODS code:
```bash
generate-prescription-ids --ods A12345 -n 3
```

Control the ODS code length for random ODS generation:
```bash
generate-prescription-ids --ods-length 4 -n 2
```

## Options

- `-n, --count <number>` - Generate a list of prescription IDs of length N (default: 1)
- `--ods <code>` - Use a specific ODS code for all generated IDs
- `--ods-length <number>` - Length of a randomly generated ODS code (3-6, default: 6)

## API

You can also use this package programmatically:

```typescript
import {
  generatePrescriptionId,
  generatePrescriptionIds,
  computePrescriptionIdCheckDigit,
  generateOdsCode
} from 'prescription-id-generator';

const id = generatePrescriptionId();
const list = generatePrescriptionIds(5);
const ods = generateOdsCode(6);
const checkDigit = computePrescriptionIdCheckDigit('ABC123-A12345-DEF45');
```

## Prescription ID Format

The generated format follows:
```
<6 alphanumeric characters>-<ODS code, truncated or padded to 6 characters>-<5 alphanumeric characters><check digit>
```
