# PSU Request Sender

Send Prescription Status Update (PSU) bundles to the PSU endpoint.

## Installation

```bash
npm install
npm run build
```

### Global Installation

```bash
npm link
```

This makes the `send-psu-request` command available system-wide.

## Usage

### As a CLI Tool

```bash
send-psu-request --input ./bundle.json
```

### As a Library

```typescript
import { obtainAccessToken, sendPsu } from "psu-request-sender";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { response } = await sendPsu(host, token, bundle);
console.log(response.status);
```

## Required Environment Variables

- `API_KEY`: APIM application API key
- `HOST`: e.g. `internal-dev.api.service.nhs.uk`
- `KID`: key ID from APIM portal
- `PRIVATE_KEY`: PEM contents of the private key

### Optional Environment Variables

- `PRIVATE_KEY_PATH`: path to PEM file (used when `PRIVATE_KEY` is not set)
- `IS_PR`: set to `true` to send to a PR sandbox URL
- `PR_NUMBER`: PR number used when `IS_PR` is true

## CLI Options

- `--input <file>`: Path to JSON bundle file
- `-h, --help`: Display help information

## Development

```bash
npm run build
```

Compiles TypeScript files from `src/` to `dist/`.
