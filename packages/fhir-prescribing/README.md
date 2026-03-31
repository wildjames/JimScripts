# FHIR Prescribing

Perform EPS FHIR prescribing actions: create, cancel, and sign.

This TypeScript package provides both a CLI tool and a programmatic API for EPS prescribing workflows.

## Current Action Support

The package recognises these actions:
- `create` — prepare, sign, and submit a prescription to EPS
- `cancel` — generate a cancellation bundle from an existing prescription and submit it to EPS
- `sign` — call `$prepare` and sign digests (or return digest with `--prepare-only`)

## Installation

```bash
npm install
npm run build
```

## Usage

### As a CLI tool

```bash
# Create: prepare, sign, and submit a prescription
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle.json

# Create with optional URID
fhir-prescribing --action create --input ./bundle.json --urid 555254240100

# Cancel: generate and submit a cancellation bundle
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle.json
```

**Options:**
- `--action <action>` - One of `create | cancel | sign`
- `--input <file>` - Input prescription bundle JSON
- `--save-dir <directory>` - Directory to save output bundle JSON (default: `./data/prescriptions`)
- `--urid <urid>` - NHSD-Session-URID value (create/cancel/sign)
- `--algorithm <alg>` - Signing algorithm (create/sign, default: `RSA-SHA1`)
- `--prepare-only` - Return digest only (sign only)
- `-h, --help` - Display help

### Required Environment Variables (for `create`, `cancel`, and `sign`)

- `HOST`: e.g. `internal-dev.api.service.nhs.uk`
- `PRESCRIBE_API_KEY`: APIM application API key
- `PRESCRIBE_KID`: key ID from APIM portal
- `PRESCRIBE_PRIVATE_KEY`: PEM contents of the private key (or `PRESCRIBE_PRIVATE_KEY_PATH`: path to PEM file)

### As a library

```typescript
import {
  createAndSubmitPrescription,
  createCancellationBundle,
  createAndSubmitCancellation
} from "fhir-prescribing";

// Create: full flow - prepare, sign, submit
const result = await createAndSubmitPrescription({
  host, apiKey, kid, privateKey,
  bundle: prescriptionBundle
});

// Cancel: synchronous bundle transformation
const cancellationBundle = createCancellationBundle(createBundleJson);

// Cancel and submit
const cancellationResult = await createAndSubmitCancellation({
  host,
  token,
  bundle: createBundleJson
});
```

## What `create` does

1. Authenticates with the APIM OAuth2 token endpoint using JWT client credentials
2. Sends the FHIR prescription Bundle to `POST /fhir-prescribing/FHIR/R4/$prepare`
3. Extracts the Base64-encoded digest from the `Parameters` response
4. Signs the digest using RSA-SHA1 (or specified algorithm)
5. Adds a Provenance resource with the signature to the bundle
6. Submits the signed bundle to `POST /fhir-prescribing/FHIR/R4/$process-message`

## What `cancel` does

For each cancellation bundle generated from an input create bundle:
- Generates a new Bundle `identifier.value` UUID
- Updates `MessageHeader.eventCoding` to `prescription-order-update`
- Clears `MessageHeader.focus`
- Sets each `MedicationRequest.status` to `cancelled`
- Adds `MedicationRequest.statusReason` with code `0001` (Prescribing Error)
- Submits the cancellation bundle to `POST /fhir-prescribing/FHIR/R4/$process-message`

## License

MIT
