# sign-prescription

Sends a FHIR prescription bundle to the `$prepare` endpoint to obtain the signing digest, then signs it using a private key.

**Package:** `prescription-signer`

## CLI Usage

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle.json
sign-prescription --input ./bundle.json --prepare-only
sign-prescription --input ./bundle.json --urid 555254240100
sign-prescription --input ./bundle.json --algorithm RSA-SHA256
```

## Options

| Flag                 | Description                           | Default      |
| -------------------- | ------------------------------------- | ------------ |
| `--input <file>`     | Path to FHIR prescription bundle JSON | required     |
| `--urid <urid>`      | NHSD-Session-URID value               | optional     |
| `--algorithm <alg>`  | Signing algorithm                     | `RSA-SHA1`   |
| `--prepare-only`     | Return digest without signing         | `false`      |
| `--user-restricted`  | Use CIS2 browser login                | `false`      |
| `--user-type <type>` | `prescriber` or `dispenser`           | `prescriber` |

## Output (JSON to stdout)

```json
{
  "digest": "PFNpZ25lZEluZm8g...",
  "signature": "dGhpcyBpcyBhIHNp...",
  "timestamp": "2026-03-30T10:00:00.000Z"
}
```

With `--prepare-only`, only `digest` and `timestamp` are returned.

## Environment Variables

### App-restricted mode (default)

| Variable                     | Required |
| ---------------------------- | -------- |
| `HOST`                       | yes      |
| `PRESCRIBE_API_KEY`          | yes      |
| `PRESCRIBE_KID`              | yes      |
| `PRESCRIBE_PRIVATE_KEY`      | one of   |
| `PRESCRIBE_PRIVATE_KEY_PATH` | these    |

### User-restricted mode (`--user-restricted`)

| Variable                      | Required |
| ----------------------------- | -------- |
| `HOST`                        | yes      |
| `PRESCRIBE_API_KEY`           | yes      |
| `PRESCRIBE_APP_CLIENT_SECRET` | yes      |
| `PRESCRIBE_CALLBACK_URL`      | yes      |
| `PRESCRIBE_PRIVATE_KEY`       | one of   |
| `PRESCRIBE_PRIVATE_KEY_PATH`  | these    |
| `HEADLESS`                    | optional |
| `FIREFOX_TMP_DIR`             | optional |

## Programmatic API

```typescript
import {
  obtainAccessToken,
  preparePrescription,
  signDigest,
  prepareAndSign,
} from "prescription-signer";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { digest, signature, timestamp } = await prepareAndSign(
  host,
  token,
  bundle,
  privateKey,
);

// Step by step
const { digest } = await preparePrescription(host, token, bundle, urid);
const signature = signDigest(digest, privateKey, "RSA-SHA1");
```

## Notes

- This tool only prepares and signs — does NOT submit. Use `fhir-prescribing --action create` for the full prepare + sign + submit flow.
