# send-psu-request

Sends a PSU FHIR Bundle to the EPS PSU API endpoint using app-restricted (JWT/signed) authentication.

**Package:** `psu-request-sender`

## CLI Usage

```bash
send-psu-request --input ./bundle.json
```

## Options

| Flag             | Description              | Default  |
| ---------------- | ------------------------ | -------- |
| `--input <file>` | Path to JSON bundle file | required |

## Environment Variables

| Variable               | Description                                       | Required |
| ---------------------- | ------------------------------------------------- | -------- |
| `HOST`                 | API host (e.g. `internal-dev.api.service.nhs.uk`) | yes      |
| `API_KEY`              | APIM application API key                          | yes      |
| `PSU_KID`              | Key ID from APIM portal                           | yes      |
| `PRIVATE_KEY`          | PEM contents of the private key                   | one of   |
| `PSU_PRIVATE_KEY_PATH` | Path to PEM file                                  | these    |
| `IS_PR`                | Set to `true` to target a PR sandbox URL          | optional |
| `PR_NUMBER`            | PR number when `IS_PR` is true                    | optional |

## Programmatic API

```typescript
import { obtainAccessToken, sendPsu } from "psu-request-sender";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { response } = await sendPsu(host, token, bundle);
console.log(response.status);
```
