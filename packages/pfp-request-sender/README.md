# PfP Request Sender

Fetch prescriptions-for-patients (PfP) bundles via the OAuth2 auth-code flow.

## Installation

```bash
npm install
npx playwright install
npm run build
```

### Global Installation

```bash
npm link
```

This makes the `send-pfp-request` command available system-wide.

## Usage

### As a CLI Tool

```bash
send-pfp-request 9998481732
```

### As a Library

```typescript
import {fetchBundle, getPfpEnv} from "pfp-request-sender";

const {host, clientId, clientSecret, redirectUri} = getPfpEnv();
const bundle = await fetchBundle(host, clientId, clientSecret, redirectUri, "9998481732");
```

## Required Environment Variables

- `HOST`: e.g. `internal-dev.api.service.nhs.uk`
- `PFP_API_KEY`: OAuth client id
- `PFP_CLIENT_SECRET`: OAuth client secret

## Optional Environment Variables

- `REDIRECT_URI`: default `https://www.google.com/`
- `AUTH_USERNAME`: mock NHS login username (default `9449304130`)
- `FIREFOX_TMP_DIR`: browser profile directory (default `./tmp/test_firefox`)
- `HEADLESS`: set to `false` to show the browser window

## CLI Options

- `--save-dir <dir>`: Directory to save the bundle JSON (default `./data/psu_requests`)
- `-h, --help`: Display help information

## Development

```bash
npm run build
```

Compiles TypeScript files from `src/` to `dist/`.
