# Prescription Signer

Prepare and sign EPS FHIR prescriptions via the `$prepare` endpoint.

## Installation

```bash
npm install
npm run build
```

### Global Installation

```bash
npm link
```

This makes the `sign-prescription` command available system-wide.

## Usage

### As a CLI Tool

```bash
# Prepare and sign a prescription bundle
sign-prescription --input ./data/prescriptions/prescription-bundle.json

# Prepare only (no signing)
sign-prescription --input ./data/prescriptions/prescription-bundle.json --prepare-only

# With a specific URID
sign-prescription --input ./bundle.json --urid 555254240100
```

### As a Library

```typescript
import {
  obtainAccessToken,
  preparePrescription,
  signDigest,
  prepareAndSign
} from "prescription-signer";

// Full flow: prepare + sign
const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const {digest, signature, timestamp} = await prepareAndSign(
  host, token, bundle, privateKey
);

// Or step by step
const {digest} = await preparePrescription(host, token, bundle, urid);
const signature = signDigest(digest, privateKey);
```

## Required Environment Variables

- `PRESCRIBE_API_KEY`: APIM application API key
- `HOST`: e.g. `internal-dev.api.service.nhs.uk`
- `PRESCRIBE_KID`: key ID from APIM portal
- `PRESCRIBE_PRIVATE_KEY`: PEM contents of the private key

### Optional Environment Variables

- `PRESCRIBE_PRIVATE_KEY_PATH`: path to PEM file (used when `PRESCRIBE_PRIVATE_KEY` is not set)

## CLI Options

- `--input <file>`: Path to FHIR prescription bundle JSON file (required)
- `--urid <urid>`: NHSD-Session-URID value
- `--algorithm <alg>`: Signing algorithm (default: `RSA-SHA1`)
- `--prepare-only`: Only call `$prepare` and return the digest without signing
- `-h, --help`: Display help information

## Output

The CLI outputs JSON to stdout:

```json
{
  "digest": "PFNpZ25lZEluZm8g...",
  "signature": "dGhpcyBpcyBhIHNp...",
  "timestamp": "2026-03-30T10:00:00.000Z"
}
```

With `--prepare-only`, only `digest` and `timestamp` are returned.

## How It Works

1. Authenticates with the APIM OAuth2 token endpoint using JWT client credentials
2. Sends the FHIR prescription Bundle to `POST /fhir-prescribing/FHIR/R4/$prepare`
3. Extracts the Base64-encoded `<SignedInfo>` digest from the `Parameters` response
4. Signs the decoded digest bytes using RSA-SHA1 (or specified algorithm)
5. Returns the digest and Base64-encoded signature

## Development

```bash
npm run build
```

Compiles TypeScript files from `src/` to `dist/`.
