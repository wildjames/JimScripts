# fhir-prescribing

Performs EPS FHIR prescribing actions on prescription bundles. Supports `create` (prepare, sign, and submit), `cancel` (generate and submit a cancellation), and `sign` (prepare and sign only).

**Package:** `fhir-prescribing`

## CLI Usage

```bash
# Create: prepare, sign, and submit a prescription to EPS
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle.json

# Create with optional URID
fhir-prescribing --action create --input ./bundle.json --urid 555254240100

# Create using Digital Signature Service (DSS) instead of local key
fhir-prescribing --action create --input ./bundle.json --dss
fhir-prescribing --action create --input ./bundle.json --dss --dss-mock

# Cancel: generate a cancellation bundle from an existing prescription
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle.json
fhir-prescribing --action cancel --input ./bundle.json --cancel-reason-type 0003

# Sign only (no submit)
fhir-prescribing --action sign --input ./bundle.json
```

## Options

| Flag                          | Description                                          | Default                |
| ----------------------------- | ---------------------------------------------------- | ---------------------- |
| `--action <action>`           | `create`, `cancel`, `sign`                           | required               |
| `--input <file>`              | Path to input prescription bundle JSON               | required               |
| `--save-dir <directory>`      | Output directory                                     | `./data/prescriptions` |
| `--urid <urid>`               | NHSD-Session-URID value (create/sign)                | optional               |
| `--algorithm <alg>`           | Signing algorithm (create/sign)                      | `RSA-SHA1`             |
| `--cancel-reason-type <code>` | Cancellation reason: `0001`–`0004`                   | `0001`                 |
| `--prepare-only`              | Return digest only (sign action)                     | `false`                |
| `--user-restricted`           | Use CIS2 browser login instead of app-restricted JWT | `false`                |
| `--user-type <type>`          | `prescriber` or `dispenser` (user-restricted mode)   | `prescriber`           |
| `--dss`                       | Use NHS Digital Signature Service for signing        | `false`                |
| `--dss-host <host>`           | Override DSS host (defaults to HOST env var)         | HOST env var           |
| `--dss-mock`                  | Mock DSS presence check (auto-completes)             | `false`                |

## What `create` does

1. Authenticates via app-restricted JWT (default) or CIS2 user-restricted OAuth2 (`--user-restricted`)
2. Sends the FHIR prescription Bundle to `POST /fhir-prescribing/FHIR/R4/$prepare`
3. Extracts the digest from the `Parameters` response
4. Signs the digest using either a local private key (default) or NHS Digital Signature Service (`--dss`)
5. Adds a Provenance resource with the signature to the bundle
6. Submits the signed bundle to `POST /fhir-prescribing/FHIR/R4/$process-message`

## DSS signing flow (when `--dss` is used)

1. Creates a signed JWT containing the digest payload(s)
2. POSTs to `/signing-service/signaturerequest` → receives a token + redirectUri
3. Performs a presence check via browser redirect (skipped on sandbox, mocked with `--dss-mock`)
4. GETs `/signing-service/signatureresponse/{token}` → receives signatures + X509 certificate
5. The certificate is embedded in the Provenance resource's X509Certificate field

## What `cancel` does

- Generates a new Bundle `identifier.value` UUID
- Changes `MessageHeader.eventCoding` to `prescription-order-update`
- Clears `MessageHeader.focus`
- Sets each `MedicationRequest.status` to `cancelled`
- Adds `MedicationRequest.statusReason` using the selected cancellation reason type (`0001` default)
- Submits the cancellation bundle to EPS

**Important:** `sign` only prepares and signs — does NOT submit. Use `create` for prepare + sign + submit.

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

### DSS signing (additional)

| Variable           | Required                                        |
| ------------------ | ----------------------------------------------- |
| `PRESCRIBE_KID`    | yes (for DSS JWT)                               |
| `DSS_CALLBACK_URL` | optional (falls back to PRESCRIBE_CALLBACK_URL) |

## Programmatic API

```typescript
import {
  createAndSubmitPrescription,
  createPrescriptionActionBundle,
  obtainAccessToken,
  preparePrescription,
  signDigest,
} from "fhir-prescribing";

// Create: full flow - prepare, sign, submit
const result = await createAndSubmitPrescription({
  host,
  apiKey,
  kid,
  privateKey,
  bundle: prescriptionBundle,
});
console.log(result.response.status, result.digest, result.signature);

// Cancel: synchronous bundle transformation
const cancellationBundle = createPrescriptionActionBundle({
  action: "cancel",
  inputBundle: existingBundleJson,
});
```
