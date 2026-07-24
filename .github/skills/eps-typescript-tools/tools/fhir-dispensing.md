# fhir-dispensing

Performs EPS FHIR dispensing actions on prescription bundles. Supports `release`, `return`, `dispense`, `withdraw`, and `claim`.

**Package:** `fhir-dispensing`

## CLI Usage

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

## Options

| Flag                               | Description                                          | Default                                                    |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `--action <action>`                | `release`, `return`, `dispense`, `withdraw`, `claim` | `release`                                                  |
| `--prescription-id <id>`           | Short-form prescription ID                           | required (except app-restricted release)                   |
| `--input <file>`                   | Path to request body JSON                            | optional for release/withdraw, required for dispense/claim |
| `--app-restricted`                 | Use app-restricted auth with `$release-unattended`   | `false`                                                    |
| `--pharmacy-ods <code>`            | Pharmacy ODS code override                           | auto-generated                                             |
| `--save-dir <directory>`           | Directory to save response Bundle JSON               | `./data/prescriptions`                                     |
| `--urid <urid>`                    | NHSD-Session-URID override                           | optional                                                   |
| `--reason-code <code>`             | Reason code (required for `return` and `withdraw`)   | —                                                          |
| `--reason-text <text>`             | Human-readable reason text                           | default for code                                           |
| `--reimbursement-authority <code>` | Reimbursement authority ODS code (for `dispense`)    | —                                                          |
| `--dispense-type <code>`           | Dispense type code: `0001`–`0008`                    | `0001`                                                     |
| `--charge-exemption <code>`        | Prescription charge exemption code (for `claim`)     | `0001`                                                     |
| `--exemption-evidence <code>`      | `evidence-seen` or `no-evidence-seen` (for `claim`)  | `no-evidence-seen`                                         |
| `--claim-status <code>`            | Claim business status: `0004`–`0007` (for `claim`)   | `0006` (Dispensed)                                         |
| `--raw`                            | Send `--input` payload as-is without normalization   | `false`                                                    |
| `--request-id <uuid>`              | Override X-Request-ID header                         | random UUID                                                |
| `--correlation-id <uuid>`          | Override X-Correlation-ID header                     | random UUID                                                |

## Return Reason Codes

| Code   | Description                                              |
| ------ | -------------------------------------------------------- |
| `0001` | Patient not present                                      |
| `0002` | Patient identity could not be verified                   |
| `0003` | Patient requested release                                |
| `0004` | Another dispenser requested release on behalf of patient |
| `0005` | Prescription otherwise unable to be dispensed            |
| `0006` | Prescription expired                                     |
| `0007` | Prescription cancelled                                   |
| `0008` | Prescription not found                                   |
| `0009` | Prescription item was not available                      |

## Withdraw Reason Codes

| Code  | Description            |
| ----- | ---------------------- |
| `MU`  | Medication Update      |
| `DA`  | Dosage Amendment       |
| `PA`  | Patient Allergy        |
| `OC`  | Other Clinical         |
| `CS`  | Clinical / Significant |
| `RE`  | Rejected / Expired     |
| `QU`  | Query                  |
| `ONC` | Other Non-Clinical     |

## Charge Exemption Codes (for claim)

| Code          | Description                                   |
| ------------- | --------------------------------------------- |
| `0001`        | Patient has paid appropriate charges          |
| `0002`        | is under 16 years of age                      |
| `0003`        | is 16, 17 or 18 and in full-time education    |
| `0004`        | is 60 years of age or over                    |
| `0005`        | has a valid maternity exemption certificate   |
| `0006`        | has a valid medical exemption certificate     |
| `0007`        | has a valid prescription pre-payment cert     |
| `0008`        | has a valid War Pension exemption certificate |
| `0009`        | is named on a current HC2 charges certificate |
| `0010`        | was prescribed free-of-charge contraceptives  |
| `0011`–`0015` | Various income-based exemptions               |

## Claim Status Codes

| Code   | Description   |
| ------ | ------------- |
| `0004` | Cancelled     |
| `0005` | Expired       |
| `0006` | Dispensed     |
| `0007` | Not Dispensed |

## What `claim` does

1. Takes a dispense notification bundle as input
2. Extracts MedicationDispense resources and patient/prescription identifiers
3. Builds a FHIR Claim resource with contained PractitionerRole and Organization
4. Includes charge exemption, evidence, and business status codes
5. Submits to `POST /fhir-dispensing/FHIR/R4/Claim`

## What `withdraw` does

1. Builds a FHIR Task resource with `status: "in-progress"` and `code: "abort"`
2. Sets `statusReason` to the selected withdraw reason code from `EPS-task-dispense-withdraw-reason`
3. Includes contained PractitionerRole and Organization resources
4. If `--input` is provided, extracts NHS number and bundle identifier from the dispense notification bundle
5. Submits to `POST /fhir-dispensing/FHIR/R4/Task`

## Environment Variables

### User-restricted mode (default)

| Variable                       | Required |
| ------------------------------ | -------- |
| `HOST`                         | yes      |
| `DISPENSING_API_KEY`           | yes      |
| `DISPENSING_APP_CLIENT_SECRET` | yes      |
| `DISPENSING_CALLBACK_URL`      | yes      |
| `HEADLESS`                     | optional |
| `FIREFOX_TMP_DIR`              | optional |

### App-restricted mode (`--app-restricted`)

| Variable                                                  | Required     |
| --------------------------------------------------------- | ------------ |
| `HOST`                                                    | yes          |
| `DISPENSING_API_KEY`                                      | yes          |
| `DISPENSING_KID`                                          | yes          |
| `DISPENSING_PRIVATE_KEY` or `DISPENSING_PRIVATE_KEY_PATH` | one of these |

## Programmatic API

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

// Return a prescription
const returnResult = await returnPrescription(
  { prescriptionId: "24F5DA-A83008-7EFE6Z", reasonCode: "0001" },
  { host, token, urid },
);

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
```
