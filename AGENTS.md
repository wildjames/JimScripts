# EPS TypeScript Tools — LLM Reference Guide

This document describes the complete set of CLI tools and programmatic APIs available in this repository. All tools relate to the NHS Electronic Prescription Service (EPS) and generate or manipulate FHIR-compliant resources for testing purposes.

## Repository Structure

This is an npm workspace monorepo with packages under `packages/`. All tools are TypeScript packages that compile to JavaScript CLIs.

### Setup

The setup has already been done as part of the devcontainer build. Only re-run these steps if a CLI command returns "command not found", or if you have edited TypeScript source files under `packages/.

```bash
# From the repository root:
make install    # Install all dependencies
make build      # Build all packages in dependency order
make link       # Globally link all CLI commands
```

The PfP Request Sender, and user-restricted mode in FHIR Prescribing, additionally require Playwright browsers:

```bash
make install-playwright
# or: cd typescript && npx playwright install
```

---

## Tool Inventory

| CLI Command                  | Package                     | Purpose                                                                             |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `generate-nhs-numbers`       | `nhs-number-generator`      | Generate/validate NHS numbers                                                       |
| `generate-ods-codes`         | `ods-code-generator`        | Generate ODS organisation codes                                                     |
| `generate-prescription-ids`  | `prescription-id-generator` | Generate prescription order numbers                                                 |
| `create-prescription-bundle` | `create-fhir-prescription`  | Create FHIR prescription message bundles                                            |
| `fhir-prescribing`           | `fhir-prescribing`          | Create, cancel, prepare, sign, and submit prescriptions (with optional DSS signing) |
| `fhir-dispensing`            | `fhir-dispensing`           | Release, return, dispense, and claim prescriptions via EPS FHIR Dispensing          |
| `sign-prescription`          | `prescription-signer`       | Prepare and sign FHIR prescriptions via the $prepare endpoint                       |
| `generate-psu-request`       | `psu-request-generator`     | Generate PSU (Prescription Status Update) FHIR bundles                              |
| `send-psu-request`           | `psu-request-sender`        | Send PSU bundles to the PSU API endpoint                                            |
| `send-pfp-request`           | `pfp-request-sender`        | Fetch Prescriptions-for-Patients bundles via OAuth2                                 |
| `make-psu-request`           | `psu-request-wizard`        | Interactive wizard combining PfP fetch and PSU generation/sending                   |
| _(library only)_             | `signing-service`           | NHS Digital Signature Service (DSS) client for signing prescriptions                |

---

## Tool Details

### 1. `generate-nhs-numbers` — NHS Number Generator

Generates valid (or intentionally invalid) 10-digit NHS numbers following the Modulus 11 check digit algorithm.

#### CLI

```bash
generate-nhs-numbers                    # One dummy NHS number (999 prefix)
generate-nhs-numbers -n 5               # Five dummy NHS numbers
generate-nhs-numbers --real -n 3        # Non-dummy NHS numbers (no 999 prefix restriction)
generate-nhs-numbers --invalid -n 2     # Numbers with incorrect check digits
generate-nhs-numbers -c 999123456       # Complete a 9-digit number with its check digit
generate-nhs-numbers -c 999123456 --invalid  # Complete with an incorrect check digit
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `-n, --count <number>` | How many to generate | 1 |
| `-c, --complete <9_digits>` | Compute check digit for a 9-digit input | — |
| `--real` | Allow non-dummy prefixes | false (999 prefix) |
| `--invalid` | Produce incorrect check digits | false |

#### Programmatic API

```typescript
import {
  generateNhsNumber,
  generateNhsNumbers,
  completeNhsNumber,
  validateNhsNumber,
  calculateCheckDigit,
} from "nhs-number-generator";

generateNhsNumber(); // → "9991234560"
generateNhsNumbers(5); // → string[]
completeNhsNumber("999123456"); // → "9991234560"
validateNhsNumber("9991234560"); // → true | false
calculateCheckDigit("999123456"); // → number
```

---

### 2. `generate-ods-codes` — ODS Code Generator

Generates Organisation Data Service (ODS) codes following observed NHS patterns.

#### CLI

```bash
generate-ods-codes                # One 6-character code
generate-ods-codes -n 5           # Five 6-character codes
generate-ods-codes -n 3 -l 4     # Three 4-character codes
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `-n, --count <number>` | How many codes to generate | 1 |
| `-l, --length <number>` | Character length (3–6) | 6 |

**Pattern rules by length:**
| Length | Pattern | Example |
|---|---|---|
| 3 | LLD (2 letters, 1 digit) | `AB3` |
| 4 | LDDD (1 letter, 3 digits) | `A123` |
| 5 | LLDDD (2 letters, 3 digits) | `FA565` |
| 6 | LDDDDD (1 letter, 5 digits) | `A83008` |

#### Programmatic API

```typescript
import { generateOdsCode, generateOdsCodes } from "ods-code-generator";

generateOdsCode(); // → "A12345" (6-char default)
generateOdsCode(5); // → "FA565"
generateOdsCodes(10, 6); // → string[] of length 10
```

---

### 3. `generate-prescription-ids` — Prescription ID Generator

Generates prescription order numbers in the format `<6 alphanumeric>-<ODS code padded to 6>-<5 alphanumeric><check digit>`.

#### CLI

```bash
generate-prescription-ids                    # One prescription ID
generate-prescription-ids -n 5               # Five prescription IDs
generate-prescription-ids --ods A12345 -n 3  # Use a fixed ODS code
generate-prescription-ids --ods-length 4     # Random ODS codes of length 4
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `-n, --count <number>` | How many IDs to generate | 1 |
| `--ods <code>` | Use a specific ODS code | random |
| `--ods-length <number>` | Length for random ODS codes (3–6) | 6 |

#### Programmatic API

```typescript
import {
  generatePrescriptionId,
  generatePrescriptionIds,
  computePrescriptionIdCheckDigit,
  generateOdsCode,
} from "prescription-id-generator";

generatePrescriptionId(); // → "ABC123-A12345-DEF45X"
generatePrescriptionIds(5); // → string[]
computePrescriptionIdCheckDigit("ABC123-A12345-DEF45"); // → check digit char
```

---

### 4. `create-prescription-bundle` — Prescription Bundle Creator

Generates complete FHIR prescription message bundles containing MessageHeader, MedicationRequest(s), Patient, PractitionerRole, Practitioner, and Organization resources.

#### CLI

```bash
create-prescription-bundle                                # Single prescription, all auto-generated
create-prescription-bundle --count 3 --nhs-number 9998481732  # 3 medication requests for a specific patient
create-prescription-bundle --pharmacy-ods FA565 --practitioner-ods A83008 --count 2
create-prescription-bundle --save-dir /tmp/my-prescriptions
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--nhs-number <number>` | Patient NHS number | auto-generated |
| `--pharmacy-ods <code>` | Pharmacy ODS code | auto-generated |
| `--practitioner-ods <code>` | Practitioner ODS code | auto-generated |
| `-n, --count <number>` | Number of MedicationRequest entries | 1 |
| `--save-dir <directory>` | Output directory | `./data/prescriptions` |

**Output:** Saves a JSON file named `prescription-bundle_<timestamp>_nhs-num-<number>.json` to the save directory.

#### Programmatic API

```typescript
import { createPrescriptionMessageBundle } from "prescription-bundle-creator";

const bundle = createPrescriptionMessageBundle({
  nhsNumber: "9998481732",
  count: 2,
  pharmacyOds: "FA565",
  practitionerOds: "A83008",
});
```

**Auto-generated data includes:** NHS numbers (999 prefix), ODS codes, prescription IDs, patient demographics (via Faker.js), and practitioner identifiers (SDS, GMC, DIN).

---

### 5. `fhir-prescribing` — FHIR Prescribing Actions

Performs EPS FHIR prescribing actions on prescription bundles. Supports `create` (prepare, sign, and submit a prescription), `cancel` (generate a cancellation bundle), and `sign` (prepare and optionally sign a prescription digest).

**Important:** The `sign` action only prepares and signs the prescription—it does NOT submit it. To submit, use `--action create` which performs prepare + sign + submit in one step. If you need to sign first and submit separately, use `sign` then manually POST the signed bundle to the `$process-message` endpoint.

#### CLI

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
fhir-prescribing --action cancel --input ./bundle.json --save-dir ./data/prescriptions
fhir-prescribing --action cancel --input ./bundle.json --cancel-reason-type 0003
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--action <action>` | Action type: `create`, `cancel`, `sign` | required |
| `--input <file>` | Path to input prescription bundle JSON | required |
| `--save-dir <directory>` | Output directory | `./data/prescriptions` |
| `--urid <urid>` | NHSD-Session-URID value (create/sign) | optional |
| `--algorithm <alg>` | Signing algorithm (create/sign) | `RSA-SHA1` |
| `--cancel-reason-type <code>` | Cancellation reason type for `cancel`: `0001`, `0002`, `0003`, `0004` | `0001` |
| `--prepare-only` | Call `$prepare` and return digest only (sign only) | `false` |
| `--user-restricted` | Use CIS2 browser login (OAuth2 auth-code) instead of app-restricted JWT | `false` |
| `--user-type <type>` | CIS2 user type for user-restricted mode: `prescriber` or `dispenser`. Use `prescriber` when the CIS2 login credential belongs to a prescribing clinician. Use `dispenser` when the credential belongs to a dispensing pharmacist. This affects which role/access scope is requested during the OAuth2 flow. | `prescriber` |
| `--dss` | Use the NHS Digital Signature Service (DSS) for signing instead of local key | `false` |
| `--dss-host <host>` | Override the DSS host (defaults to HOST env var) | HOST env var |
| `--dss-mock` | Use mock mode for DSS presence check (auto-completes without smartcard) | `false` |

**Environment variables (app-restricted mode, required for `create`/`sign`):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `PRESCRIBE_API_KEY` | APIM application API key | yes |
| `PRESCRIBE_KID` | Key ID from APIM portal | yes |
| `PRESCRIBE_PRIVATE_KEY` | PEM contents of the private key | one of these |
| `PRESCRIBE_PRIVATE_KEY_PATH` | Path to PEM file | one of these |

**Environment variables (user-restricted mode, required for `create`/`sign` with `--user-restricted`):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `PRESCRIBE_API_KEY` | OAuth client ID for EPS FHIR Prescribing user-restricted auth | yes |
| `PRESCRIBE_APP_CLIENT_SECRET` | OAuth client secret for EPS FHIR Prescribing user-restricted auth | yes |
| `PRESCRIBE_CALLBACK_URL` | OAuth callback URL registered for the app (e.g. `https://google.com`) | yes |
| `PRESCRIBE_PRIVATE_KEY` | PEM contents of the private key used to sign the digest | one of these |
| `PRESCRIBE_PRIVATE_KEY_PATH` | Path to PEM file used to sign the digest | one of these |
| `HEADLESS` | Set `false` to show browser during login | optional |
| `FIREFOX_TMP_DIR` | Browser profile directory for Playwright | optional |

**Supported actions:** `create`, `cancel`, and `sign` are implemented.

**What `create` does:**

1. Authenticates via CIS2 user-restricted OAuth2 flow (browser-automated)
2. Sends the FHIR prescription Bundle to `POST /fhir-prescribing/FHIR/R4/$prepare`
3. Extracts the digest from the `Parameters` response
4. Signs the digest using either a local private key (default) or the NHS Digital Signature Service (`--dss`)
5. Adds a Provenance resource with the signature to the bundle
6. Submits the signed bundle to `POST /fhir-prescribing/FHIR/R4/$process-message`

**DSS signing flow (when `--dss` is used):**

1. Creates a signed JWT containing the digest payload(s)
2. POSTs to `/signing-service/signaturerequest` → receives a token + redirectUri
3. Performs a presence check via browser redirect (skipped on sandbox, mocked with `--dss-mock`)
4. GETs `/signing-service/signatureresponse/{token}` → receives signatures + X509 certificate
5. The certificate is embedded in the Provenance resource's X509Certificate field

**What `cancel` does to the bundle:**

- Generates a new Bundle `identifier.value` UUID
- Changes `MessageHeader.eventCoding` to `prescription-order-update`
- Clears `MessageHeader.focus`
- Sets each `MedicationRequest.status` to `cancelled`
- Adds `MedicationRequest.statusReason` using the selected cancellation reason type (`0001` default)

#### Programmatic API

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

---

### 6. `sign-prescription` — Prescription Signer

Sends a FHIR prescription bundle to the `$prepare` endpoint to obtain the signing digest, then signs it using a private key. Supports both app-restricted JWT auth and user-restricted CIS2 browser auth via `--user-restricted`.

#### CLI

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle.json
sign-prescription --input ./bundle.json --prepare-only
sign-prescription --input ./bundle.json --urid 555254240100
sign-prescription --input ./bundle.json --algorithm RSA-SHA256
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--input <file>` | Path to FHIR prescription bundle JSON file | required |
| `--urid <urid>` | NHSD-Session-URID value | optional |
| `--algorithm <alg>` | Signing algorithm | `RSA-SHA1` |
| `--prepare-only` | Only call `$prepare` and return the digest without signing | `false` |
| `--user-restricted` | Use CIS2 browser login (OAuth2 auth-code) instead of app-restricted JWT | `false` |
| `--user-type <type>` | CIS2 user type for user-restricted mode: `prescriber` or `dispenser` | `prescriber` |

**Environment variables (app-restricted mode):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `PRESCRIBE_API_KEY` | APIM application API key | yes |
| `PRESCRIBE_KID` | Key ID from APIM portal | yes |
| `PRESCRIBE_PRIVATE_KEY` | PEM contents of the private key | one of these |
| `PRESCRIBE_PRIVATE_KEY_PATH` | Path to PEM file | one of these |

**Environment variables (user-restricted mode):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `PRESCRIBE_API_KEY` | OAuth client ID for EPS FHIR Prescribing user-restricted auth | yes |
| `PRESCRIBE_APP_CLIENT_SECRET` | OAuth client secret for EPS FHIR Prescribing user-restricted auth | yes |
| `PRESCRIBE_CALLBACK_URL` | OAuth callback URL registered for the app (e.g. `https://google.com`) | yes |
| `PRESCRIBE_PRIVATE_KEY` | PEM contents of the private key used to sign the digest | one of these |
| `PRESCRIBE_PRIVATE_KEY_PATH` | Path to PEM file used to sign the digest | one of these |
| `HEADLESS` | Set `false` to show browser during login | optional |
| `FIREFOX_TMP_DIR` | Browser profile directory for Playwright | optional |

**Output (JSON to stdout):**

```json
{
  "digest": "PFNpZ25lZEluZm8g...",
  "signature": "dGhpcyBpcyBhIHNp...",
  "timestamp": "2026-03-30T10:00:00.000Z"
}
```

With `--prepare-only`, only `digest` and `timestamp` are returned.

#### Programmatic API

```typescript
import {
  obtainAccessToken,
  preparePrescription,
  signDigest,
  prepareAndSign,
} from "prescription-signer";

// Full flow
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

---

### 7. `fhir-dispensing` — FHIR Dispensing Actions

Performs EPS FHIR dispensing actions on prescription bundles. Supports `release` (download prescriptions), `return` (return prescriptions to EPS), `dispense` (send dispense notifications), and `claim` (submit reimbursement claims).

#### CLI

```bash
# Release: download a prescription from EPS (user-restricted)
fhir-dispensing --action release --prescription-id 24F5DA-A83008-7EFE6Z

# Release: unattended (app-restricted, no prescription-id needed)
fhir-dispensing --action release --app-restricted --pharmacy-ods FA565

# Return: return a prescription to EPS
fhir-dispensing --action return --prescription-id 24F5DA-A83008-7EFE6Z --reason-code 0001

# Dispense: send a dispense notification (requires released prescription bundle as input)
fhir-dispensing --action dispense --prescription-id 24F5DA-A83008-7EFE6Z --input ./data/prescriptions/release-bundle.json

# Claim: submit a reimbursement claim (requires dispense notification bundle as input)
fhir-dispensing --action claim --prescription-id 24F5DA-A83008-7EFE6Z --input ./data/prescriptions/dispense-bundle.json
fhir-dispensing --action claim --prescription-id 24F5DA-A83008-7EFE6Z --input ./dispense.json --charge-exemption 0002

# Withdraw: withdraw a dispense notification
fhir-dispensing --action withdraw --prescription-id 24F5DA-A83008-7EFE6Z --reason-code MU
fhir-dispensing --action withdraw --prescription-id 24F5DA-A83008-7EFE6Z --reason-code DA --input ./data/prescriptions/dispense-bundle.json
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--action <action>` | Dispensing action: `release`, `return`, `dispense`, `withdraw`, `claim` | `release` |
| `--prescription-id <id>` | Short-form prescription ID | required (except app-restricted release) |
| `--input <file>` | Path to request body JSON | optional for release/withdraw, required for dispense/claim |
| `--app-restricted` | Use app-restricted auth with `$release-unattended` | `false` |
| `--pharmacy-ods <code>` | Pharmacy ODS code override | auto-generated |
| `--save-dir <directory>` | Directory to save response Bundle JSON | `./data/prescriptions` |
| `--urid <urid>` | NHSD-Session-URID override | optional |
| `--reason-code <code>` | Reason code (required for `return` and `withdraw`) | — |
| `--reason-text <text>` | Human-readable reason text | default for code |
| `--reimbursement-authority <code>` | Reimbursement authority ODS code (for `dispense`) | — |
| `--dispense-type <code>` | Dispense type code: `0001`–`0008` | `0001` |
| `--charge-exemption <code>` | Prescription charge exemption code (for `claim`) | `0001` |
| `--exemption-evidence <code>` | `evidence-seen` or `no-evidence-seen` (for `claim`) | `no-evidence-seen` |
| `--claim-status <code>` | Claim business status: `0004`–`0007` (for `claim`) | `0006` (Dispensed) |
| `--raw` | Send `--input` payload as-is without normalization | `false` |
| `--request-id <uuid>` | Override X-Request-ID header | random UUID |
| `--correlation-id <uuid>` | Override X-Correlation-ID header | random UUID |

**Return reason codes:**
| Code | Description |
|---|---|
| `0001` | Patient not present |
| `0002` | Patient identity could not be verified |
| `0003` | Patient requested release |
| `0004` | Another dispenser requested release on behalf of the patient |
| `0005` | Prescription otherwise unable to be dispensed |
| `0006` | Prescription expired |
| `0007` | Prescription cancelled |
| `0008` | Prescription not found |
| `0009` | Prescription item was not available |

**Withdraw reason codes:**
| Code | Description |
|---|---|
| `MU` | Medication Update |
| `DA` | Dosage Amendment |
| `PA` | Patient Allergy |
| `OC` | Other Clinical |
| `CS` | Clinical / Significant |
| `RE` | Rejected / Expired |
| `QU` | Query |
| `ONC` | Other Non-Clinical |

**Charge exemption codes (for claim):**
| Code | Description |
|---|---|
| `0001` | Patient has paid appropriate charges |
| `0002` | is under 16 years of age |
| `0003` | is 16, 17 or 18 and in full-time education |
| `0004` | is 60 years of age or over |
| `0005` | has a valid maternity exemption certificate |
| `0006` | has a valid medical exemption certificate |
| `0007` | has a valid prescription pre-payment certificate |
| `0008` | has a valid War Pension exemption certificate |
| `0009` | is named on a current HC2 charges certificate |
| `0010` | was prescribed free-of-charge contraceptives |
| `0011`–`0015` | Various income-based exemptions |

**Claim status codes:**
| Code | Description |
|---|---|
| `0004` | Cancelled |
| `0005` | Expired |
| `0006` | Dispensed |
| `0007` | Not Dispensed |

**Environment variables (user-restricted mode, default):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `DISPENSING_API_KEY` | OAuth client ID | yes |
| `DISPENSING_APP_CLIENT_SECRET` | OAuth client secret | yes |
| `DISPENSING_CALLBACK_URL` | OAuth callback URL | yes |
| `HEADLESS` | Set `false` to show browser during login | optional |
| `FIREFOX_TMP_DIR` | Browser profile directory | optional |

**Environment variables (app-restricted mode, `--app-restricted`):**
| Variable | Description | Required |
|---|---|---|
| `HOST` | e.g. `internal-dev.api.service.nhs.uk` | yes |
| `DISPENSING_API_KEY` | APIM application API key | yes |
| `DISPENSING_KID` | Key ID from APIM portal | yes |
| `DISPENSING_PRIVATE_KEY` or `DISPENSING_PRIVATE_KEY_PATH` | PEM private key | one of these |

**What `claim` does:**

1. Takes a dispense notification bundle as input
2. Extracts MedicationDispense resources and patient/prescription identifiers
3. Builds a FHIR Claim resource with contained PractitionerRole and Organization
4. Includes charge exemption, evidence, and business status codes
5. Submits to `POST /fhir-dispensing/FHIR/R4/Claim`

**What `withdraw` does:**

1. Builds a FHIR Task resource with `status: "in-progress"` and `code: "abort"`
2. Sets `statusReason` to the selected withdraw reason code from `EPS-task-dispense-withdraw-reason`
3. Includes contained PractitionerRole and Organization resources
4. If `--input` is provided, extracts NHS number and bundle identifier from the dispense notification bundle
5. Submits to `POST /fhir-dispensing/FHIR/R4/Task`

#### Programmatic API

```typescript
import {
  releaseTask,
  returnPrescription,
  dispenseNotification,
  withdrawDispenseNotification,
  submitClaim,
  generateClaim,
  CHARGE_EXEMPTION_CODES,
  CLAIM_STATUS_CODES,
  RETURN_REASON_CODES,
  WITHDRAW_REASON_CODES,
  DISPENSE_TYPE_CODES,
} from "fhir-dispensing";

// Submit a claim from a dispense notification bundle
const result = await submitClaim(
  dispenseBundle,
  {
    prescriptionId: "24F5DA-A83008-7EFE6Z",
    chargeExemption: "0001",
    exemptionEvidence: "no-evidence-seen",
    claimStatus: "0006",
  },
  { host, token, urid },
);
console.log(result.response.status);

// Withdraw a dispense notification
const withdrawResult = await withdrawDispenseNotification(
  {
    prescriptionId: "24F5DA-A83008-7EFE6Z",
    reasonCode: "MU",
    pharmacyOds: "VNE51",
    nhsNumber: "9449304130",
    dispenseNotificationBundleId: "a14d4fc1-82a2-4a82-aae2-50e212e7b907",
  },
  { host, token, urid },
);
console.log(withdrawResult.response.status);
```

---

### 8. `generate-psu-request` — PSU Request Generator

Generates FHIR Bundle resources containing Task entries for Prescription Status Updates.

#### CLI

```bash
generate-psu-request --business-status "With Pharmacy"
generate-psu-request --business-status "Ready to Collect" --nhs-number 9998481732 -o output.json
generate-psu-request --business-status "Dispatched" --post-dated 24 -o post-dated.json
generate-psu-request --business-status "Collected" --num-entries 5 -o multi.json
generate-psu-request --business-status "Not Dispensed" --ods-code FA565 --order-number 9A822C-A83008-13DCAB
generate-psu-request --business-status "With Pharmacy" | jq '.entry[0].resource'
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--business-status <status>` | **Required.** One of the statuses below | — |
| `--order-number <number>` | Prescription order number | auto-generated |
| `--order-item-number <uuid>` | Prescription order item number (UUID) | auto-generated |
| `--nhs-number <number>` | Patient NHS number | auto-generated |
| `--ods-code <code>` | ODS organisation code | auto-generated |
| `--last-modified <timestamp>` | ISO-8601 UTC timestamp | current time |
| `--post-dated <hours>` | Hours to post-date the prescription | — |
| `--num-entries <count>` | Number of Task entries in the bundle | 1 |
| `-o, --output <file>` | Output file path | STDOUT |

**Valid business statuses:**

- `With Pharmacy`
- `Ready to Collect`
- `Ready to Dispatch`
- `Dispatched`
- `Collected`
- `Not Dispensed`

#### Programmatic API

```typescript
import { generateCreatePrescriptionBundle } from "psu-request-generator";

const bundle = generateCreatePrescriptionBundle({
  businessStatus: "With Pharmacy",
  nhsNumber: "9998481732",
  numEntries: 1,
});
```

---

### 9. `send-psu-request` — PSU Request Sender

Sends a PSU FHIR Bundle to the EPS PSU API endpoint using app-restricted (JWT/signed) authentication.

#### CLI

```bash
send-psu-request --input ./bundle.json
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--input <file>` | Path to JSON bundle file | required |

**Required environment variables:**
| Variable | Description |
|---|---|
| `API_KEY` | APIM application API key |
| `HOST` | API host, e.g. `internal-dev.api.service.nhs.uk` |
| `PSU_KID` | Key ID from APIM portal |
| `PRIVATE_KEY` | PEM contents of the private key |

**Optional environment variables:**
| Variable | Description |
|---|---|
| `PSU_PRIVATE_KEY_PATH` | Path to PEM file (used when `PRIVATE_KEY` is not set) |
| `IS_PR` | Set to `true` to target a PR sandbox URL |
| `PR_NUMBER` | PR number when `IS_PR` is true |

#### Programmatic API

```typescript
import { obtainAccessToken, sendPsu } from "psu-request-sender";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { response } = await sendPsu(host, token, bundle);
console.log(response.status);
```

---

### 10. `send-pfp-request` — PfP Request Sender

Fetches Prescriptions-for-Patients (PfP) bundles using the OAuth2 authorization-code flow. Uses Playwright to automate the NHS login in a browser.

#### CLI

```bash
send-pfp-request 9998481732
send-pfp-request 9998481732 --save-dir ./data/psu_requests
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `--save-dir <dir>` | Directory to save the bundle JSON | `./data/psu_requests` |

**Required environment variables:**
| Variable | Description |
|---|---|
| `HOST` | API host, e.g. `internal-dev.api.service.nhs.uk` |
| `PFP_API_KEY` | OAuth client ID |
| `PFP_CLIENT_SECRET` | OAuth client secret |

**Optional environment variables:**
| Variable | Description | Default |
|---|---|---|
| `REDIRECT_URI` | OAuth redirect URI | `https://www.google.com/` |
| `AUTH_USERNAME` | Mock NHS login username | `9449304130` |
| `FIREFOX_TMP_DIR` | Browser profile directory | `./tmp/test_firefox` |
| `HEADLESS` | Set `false` to show browser | true |

**Prerequisites:** Playwright browsers must be installed (`npx playwright install`).

#### Programmatic API

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

---

### 11. `make-psu-request` — PSU Request Wizard

Interactive wizard that combines PfP fetching, PSU bundle generation, and optional sending. Three modes of operation:

| Flags Present | Mode | Requirements |
|--wizard | Synthetic | No env vars needed |
|--input <file> | From File | No env vars needed |
|--nhs-number (without --wizard) | Live PfP | PFP env vars required |

#### Mode 1: Synthetic Wizard

Build PSU bundles with fully synthetic data interactively:

```bash
make-psu-request --wizard --nhs-number 9991234567
```

#### Mode 2: From PfP File

Build PSU bundles from a previously saved PfP response file:

```bash
make-psu-request --input ./data/pfp_responses/example.json
```

#### Mode 3: Live PfP Fetch

Fetch PfP by NHS number, then interactively select medication requests to build PSU entries:

```bash
make-psu-request --nhs-number 9991234567
make-psu-request --nhs-number 9991234567 --send   # Also send the result
```

**Options:**
| Flag | Description | Default |
|---|---|---|
| `-w, --wizard` | Run synthetic-data wizard mode | false |
| `-i, --input <file>` | Path to PfP response JSON | — |
| `-n, --nhs-number <number>` | NHS number for PfP fetch mode | — |
| `--ods-code <code>` | ODS code override (wizard mode) | auto-generated |
| `--business-status <status>` | Default business status (wizard mode) | `With Pharmacy` |
| `-o, --output <file>` | Write output bundle to file | — |
| `-s, --send` | Send the generated bundle to PSU endpoint | false |
| `--save-dir <dir>` | Auto-save directory | `./data/psu_requests` |
| `-c, --clipboard` | Copy to clipboard (not yet implemented) | false |

**Notes:**

- All generated bundles are auto-saved with a `psu-request` prefix before final output/send.
- In PfP-based interactive mode, entering an invalid medication selection exits the selection loop.
- Business status selection accepts menu numbers or case-insensitive exact text.

#### Programmatic API

```typescript
import { runWizard } from "psu-request-wizard";

await runWizard({
  wizard: true,
  nhsNumber: "9991234567",
  businessStatus: "With Pharmacy",
  clipboard: false,
  send: false,
  saveDir: "./data/psu_requests",
});
```

---

## Common Workflows

### Workflow 1: Create and Cancel a Prescription

```bash
# Step 1: Create a prescription bundle
create-prescription-bundle --nhs-number 9998481732 --count 2

# Step 2: Cancel it (use the output file from step 1)
prescription-action --action cancel \
  --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-9998481732.json
```

### Workflow 2: Generate and Send a PSU

```bash
# Step 1: Generate a PSU bundle
generate-psu-request --business-status "With Pharmacy" --nhs-number 9998481732 -o psu.json

# Step 2: Send it (requires env vars: API_KEY, HOST, PSU_KID, PRIVATE_KEY)
send-psu-request --input psu.json
```

### Workflow 3: Full PfP-to-PSU Flow (Interactive)

```bash
# Combines PfP fetch + interactive PSU building + sending
# Requires env vars for both PfP (HOST, PFP_API_KEY, PFP_CLIENT_SECRET)
# and PSU sending (API_KEY, HOST, PSU_KID, PRIVATE_KEY)
make-psu-request --nhs-number 9998481732 --send
```

### Workflow 4: Generate Test Data Only

```bash
# Generate identifiers for use in other tools or tests
generate-nhs-numbers -n 10
generate-ods-codes -n 5
generate-prescription-ids -n 3
```

---

## Environment Variable Summary

| Variable                       | Used By                                                                                                                | Description                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `PRESCRIBE_API_KEY`            | `fhir-prescribing`, `sign-prescription`                                                                                | APIM application API key (app-restricted mode)                           |
| `PRESCRIBE_KID`                | `fhir-prescribing`, `sign-prescription`                                                                                | Key ID from APIM portal (app-restricted mode)                            |
| `PRESCRIBE_PRIVATE_KEY`        | `fhir-prescribing`, `sign-prescription`                                                                                | PEM private key contents for digest signing                              |
| `PRESCRIBE_PRIVATE_KEY_PATH`   | `fhir-prescribing`, `sign-prescription`                                                                                | Path to PEM private key file for digest signing                          |
| `PRESCRIBE_APP_CLIENT_SECRET`  | `fhir-prescribing`, `sign-prescription`                                                                                | OAuth client secret (user-restricted mode)                               |
| `PRESCRIBE_CALLBACK_URL`       | `fhir-prescribing`, `sign-prescription`                                                                                | OAuth callback URL (user-restricted mode)                                |
| `DSS_CALLBACK_URL`             | `fhir-prescribing`                                                                                                     | DSS presence check callback URL (falls back to `PRESCRIBE_CALLBACK_URL`) |
| `DISPENSING_API_KEY`           | `fhir-dispensing`                                                                                                      | OAuth client ID / APIM API key for dispensing                            |
| `DISPENSING_APP_CLIENT_SECRET` | `fhir-dispensing`                                                                                                      | OAuth client secret (user-restricted mode)                               |
| `DISPENSING_CALLBACK_URL`      | `fhir-dispensing`                                                                                                      | OAuth callback URL (user-restricted mode)                                |
| `DISPENSING_KID`               | `fhir-dispensing`                                                                                                      | Key ID from APIM portal (app-restricted mode)                            |
| `DISPENSING_PRIVATE_KEY`       | `fhir-dispensing`                                                                                                      | PEM private key (app-restricted mode)                                    |
| `DISPENSING_PRIVATE_KEY_PATH`  | `fhir-dispensing`                                                                                                      | Path to PEM private key file (app-restricted mode)                       |
| `API_KEY`                      | `send-psu-request`, `make-psu-request`                                                                                 | APIM application API key                                                 |
| `HOST`                         | `fhir-prescribing`, `fhir-dispensing`, `sign-prescription`, `send-psu-request`, `send-pfp-request`, `make-psu-request` | API host (e.g. `internal-dev.api.service.nhs.uk`)                        |
| `PSU_KID`                      | `send-psu-request`, `make-psu-request`                                                                                 | Key ID from APIM portal                                                  |
| `PRIVATE_KEY`                  | `send-psu-request`, `make-psu-request`                                                                                 | PEM private key contents                                                 |
| `PSU_PRIVATE_KEY_PATH`         | `send-psu-request`, `make-psu-request`                                                                                 | Path to PEM private key file                                             |
| `PFP_API_KEY`                  | `send-pfp-request`, `make-psu-request`                                                                                 | OAuth client ID for PfP                                                  |
| `PFP_CLIENT_SECRET`            | `send-pfp-request`, `make-psu-request`                                                                                 | OAuth client secret for PfP                                              |
| `REDIRECT_URI`                 | `send-pfp-request`                                                                                                     | OAuth redirect URI                                                       |
| `AUTH_USERNAME`                | `send-pfp-request`                                                                                                     | Mock NHS login username                                                  |
| `FIREFOX_TMP_DIR`              | `fhir-prescribing`, `fhir-dispensing`, `sign-prescription`, `send-pfp-request`                                         | Browser profile directory                                                |
| `HEADLESS`                     | `fhir-prescribing`, `fhir-dispensing`, `sign-prescription`, `send-pfp-request`                                         | Show/hide browser (`true`/`false`)                                       |
| `IS_PR`                        | `send-psu-request`, `fhir-dispensing`                                                                                  | Target PR sandbox URL                                                    |
| `PR_NUMBER`                    | `send-psu-request`, `fhir-dispensing`                                                                                  | PR number for sandbox URL                                                |

---

## Data Directories

| Path                    | Contents                                            |
| ----------------------- | --------------------------------------------------- |
| `./data/prescriptions/` | Saved prescription bundles and cancellation bundles |
| `./data/psu_requests/`  | Saved PSU request bundles and PfP responses         |
| `./data/keys/`          | JWKS key pairs for app-restricted authentication    |

---

## Key Domain Concepts

- **NHS Number**: 10-digit patient identifier. The 10th digit is a Modulus 11 check digit. Test/dummy numbers use the `999` prefix.
- **ODS Code**: Organisation Data Service code identifying an NHS organisation (pharmacy, GP practice, etc.).
- **Prescription ID**: A structured order number in the format `XXXXXX-YYYYYY-ZZZZZC` where C is a check digit.
- **FHIR Bundle**: An HL7 FHIR resource container. Prescriptions and PSU updates are transmitted as Bundle resources.
- **PSU (Prescription Status Update)**: A FHIR Task-based update indicating the current status of a prescription in the dispensing workflow.
- **PfP (Prescriptions for Patients)**: An API that returns all prescriptions for a given patient NHS number.
- **Business Status**: The dispensing lifecycle stage of a prescription — one of: `With Pharmacy`, `Ready to Collect`, `Ready to Dispatch`, `Dispatched`, `Collected`, `Not Dispensed`.
- **App-Restricted Auth**: JWT-based authentication using a signed token (requires API_KEY, PSU_KID, and PRIVATE_KEY).
- **OAuth2 Auth-Code Flow**: Browser-based authentication used by the PfP endpoint (requires PFP_API_KEY and PFP_CLIENT_SECRET).
