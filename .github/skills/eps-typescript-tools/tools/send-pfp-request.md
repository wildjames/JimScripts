# send-pfp-request

Fetches Prescriptions-for-Patients (PfP) bundles using the OAuth2 authorization-code flow. Uses Playwright to automate the NHS login in a browser.

**Package:** `pfp-request-sender`

## CLI Usage

```bash
send-pfp-request 9998481732
send-pfp-request 9998481732 --save-dir ./data/psu_requests
```

## Options

| Flag               | Description                       | Default               |
| ------------------ | --------------------------------- | --------------------- |
| `--save-dir <dir>` | Directory to save the bundle JSON | `./data/psu_requests` |

The first positional argument is the NHS number to fetch prescriptions for.

## Environment Variables

| Variable            | Description                        | Required                                      |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| `HOST`              | API host                           | yes                                           |
| `PFP_API_KEY`       | OAuth client ID                    | yes                                           |
| `PFP_CLIENT_SECRET` | OAuth client secret                | yes                                           |
| `REDIRECT_URI`      | OAuth redirect URI                 | optional (default: `https://www.google.com/`) |
| `AUTH_USERNAME`     | Mock NHS login username            | optional (default: `9449304130`)              |
| `FIREFOX_TMP_DIR`   | Browser profile directory          | optional                                      |
| `HEADLESS`          | Show/hide browser (`true`/`false`) | optional (default: `true`)                    |

## Prerequisites

Playwright browsers must be installed:

```bash
make install-playwright
```

## Programmatic API

```typescript
import { fetchBundle, getPfpEnv } from "pfp-request-sender";

const { host, clientId, clientSecret, redirectUri } = getPfpEnv();
const bundle = await fetchBundle(
  host,
  clientId,
  clientSecret,
  redirectUri,
  "9998481732",
);
```
