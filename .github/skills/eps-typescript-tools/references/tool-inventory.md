# CLI Tool Inventory

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

## Data Generation Tools

### `generate-nhs-numbers`

Generates valid (or intentionally invalid) 10-digit NHS numbers following the Modulus 11 check digit algorithm.

```bash
generate-nhs-numbers                    # One dummy NHS number (999 prefix)
generate-nhs-numbers -n 5               # Five dummy NHS numbers
generate-nhs-numbers --real -n 3        # Non-dummy NHS numbers (no 999 prefix restriction)
generate-nhs-numbers --invalid -n 2     # Numbers with incorrect check digits
generate-nhs-numbers -c 999123456       # Complete a 9-digit number with its check digit
```

| Flag                        | Description                             | Default            |
| --------------------------- | --------------------------------------- | ------------------ |
| `-n, --count <number>`      | How many to generate                    | 1                  |
| `-c, --complete <9_digits>` | Compute check digit for a 9-digit input | —                  |
| `--real`                    | Allow non-dummy prefixes                | false (999 prefix) |
| `--invalid`                 | Produce incorrect check digits          | false              |

### `generate-ods-codes`

Generates ODS codes following observed NHS patterns.

```bash
generate-ods-codes                # One 6-character code
generate-ods-codes -n 5           # Five 6-character codes
generate-ods-codes -n 3 -l 4     # Three 4-character codes
```

| Flag                    | Description                | Default |
| ----------------------- | -------------------------- | ------- |
| `-n, --count <number>`  | How many codes to generate | 1       |
| `-l, --length <number>` | Character length (3–6)     | 6       |

Pattern rules: 3=LLD, 4=LDDD, 5=LLDDD, 6=LDDDDD

### `generate-prescription-ids`

Generates prescription order numbers in format `XXXXXX-YYYYYY-ZZZZZC`.

```bash
generate-prescription-ids                    # One prescription ID
generate-prescription-ids -n 5               # Five prescription IDs
generate-prescription-ids --ods A12345 -n 3  # Use a fixed ODS code
```

| Flag                    | Description                       | Default |
| ----------------------- | --------------------------------- | ------- |
| `-n, --count <number>`  | How many IDs to generate          | 1       |
| `--ods <code>`          | Use a specific ODS code           | random  |
| `--ods-length <number>` | Length for random ODS codes (3–6) | 6       |

## Prescription Bundle Tools

### `create-prescription-bundle`

Creates complete FHIR prescription message bundles.

```bash
create-prescription-bundle
create-prescription-bundle --count 3 --nhs-number 9998481732
create-prescription-bundle --pharmacy-ods FA565 --practitioner-ods A83008 --count 2
create-prescription-bundle --save-dir /tmp/my-prescriptions
```

| Flag                        | Description                         | Default                |
| --------------------------- | ----------------------------------- | ---------------------- |
| `--nhs-number <number>`     | Patient NHS number                  | auto-generated         |
| `--pharmacy-ods <code>`     | Pharmacy ODS code                   | auto-generated         |
| `--practitioner-ods <code>` | Practitioner ODS code               | auto-generated         |
| `-n, --count <number>`      | Number of MedicationRequest entries | 1                      |
| `--save-dir <directory>`    | Output directory                    | `./data/prescriptions` |

Output: `prescription-bundle_<timestamp>_nhs-num-<number>.json`

### `fhir-prescribing`

Performs EPS FHIR prescribing actions. Supports `create`, `cancel`, and `sign`.

```bash
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle.json
fhir-prescribing --action create --input ./bundle.json --urid 555254240100
fhir-prescribing --action create --input ./bundle.json --dss
fhir-prescribing --action create --input ./bundle.json --dss --dss-mock
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle.json
fhir-prescribing --action cancel --input ./bundle.json --cancel-reason-type 0003
```

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

**Important:** `sign` only prepares and signs — does NOT submit. Use `create` for prepare + sign + submit.

### `sign-prescription`

Sends a bundle to `$prepare` to get a digest, then signs it.

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle.json
sign-prescription --input ./bundle.json --prepare-only
sign-prescription --input ./bundle.json --algorithm RSA-SHA256
```

| Flag                 | Description                           | Default      |
| -------------------- | ------------------------------------- | ------------ |
| `--input <file>`     | Path to FHIR prescription bundle JSON | required     |
| `--urid <urid>`      | NHSD-Session-URID value               | optional     |
| `--algorithm <alg>`  | Signing algorithm                     | `RSA-SHA1`   |
| `--prepare-only`     | Return digest without signing         | `false`      |
| `--user-restricted`  | Use CIS2 browser login                | `false`      |
| `--user-type <type>` | `prescriber` or `dispenser`           | `prescriber` |

## Dispensing Tools

### `fhir-dispensing`

Performs EPS FHIR dispensing actions. Supports `release`, `return`, `dispense`, and `claim`.

```bash
# Release (user-restricted)
fhir-dispensing --action release --prescription-id 24F5DA-A83008-7EFE6Z

# Release (app-restricted, no prescription-id needed)
fhir-dispensing --action release --app-restricted --pharmacy-ods FA565

# Return
fhir-dispensing --action return --prescription-id 24F5DA-A83008-7EFE6Z --reason-code 0001

# Dispense
fhir-dispensing --action dispense --prescription-id 24F5DA-A83008-7EFE6Z --input ./data/prescriptions/release-bundle.json

# Claim
fhir-dispensing --action claim --prescription-id 24F5DA-A83008-7EFE6Z --input ./data/prescriptions/dispense-bundle.json
fhir-dispensing --action claim --prescription-id 24F5DA-A83008-7EFE6Z --input ./dispense.json --charge-exemption 0002
```

| Flag                               | Description                                          | Default                                           |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `--action <action>`                | `release`, `return`, `dispense`, `withdraw`, `claim` | `release`                                         |
| `--prescription-id <id>`           | Short-form prescription ID                           | required (except app-restricted release)          |
| `--input <file>`                   | Path to request body JSON                            | optional for release, required for dispense/claim |
| `--app-restricted`                 | Use app-restricted auth with `$release-unattended`   | `false`                                           |
| `--pharmacy-ods <code>`            | Pharmacy ODS code override                           | auto-generated                                    |
| `--save-dir <directory>`           | Directory to save response Bundle JSON               | `./data/prescriptions`                            |
| `--urid <urid>`                    | NHSD-Session-URID override                           | optional                                          |
| `--reason-code <code>`             | Return reason code (required for `return`)           | —                                                 |
| `--reason-text <text>`             | Human-readable return reason text                    | default for code                                  |
| `--reimbursement-authority <code>` | Reimbursement authority ODS code (for `dispense`)    | —                                                 |
| `--dispense-type <code>`           | Dispense type code: `0001`–`0008`                    | `0001`                                            |
| `--charge-exemption <code>`        | Prescription charge exemption code (for `claim`)     | `0001`                                            |
| `--exemption-evidence <code>`      | `evidence-seen` or `no-evidence-seen` (for `claim`)  | `no-evidence-seen`                                |
| `--claim-status <code>`            | Claim business status: `0004`–`0007` (for `claim`)   | `0006` (Dispensed)                                |
| `--raw`                            | Send `--input` payload as-is                         | `false`                                           |
| `--request-id <uuid>`              | Override X-Request-ID header                         | random UUID                                       |
| `--correlation-id <uuid>`          | Override X-Correlation-ID header                     | random UUID                                       |

**Return reason codes:** `0001`–`0009` (Patient not present, Identity unverified, Patient requested, Another dispenser requested, Unable to dispense, Expired, Cancelled, Not found, Item not available)

**Charge exemption codes (for claim):** `0001`–`0015` (paid, under 16, 16-18 education, 60+, maternity, medical, pre-payment, war pension, HC2, contraceptives, income-based exemptions)

**Claim status codes:** `0004` Cancelled, `0005` Expired, `0006` Dispensed, `0007` Not Dispensed

## PSU Tools

### `generate-psu-request`

Generates FHIR Bundles with Task entries for Prescription Status Updates.

```bash
generate-psu-request --business-status "With Pharmacy"
generate-psu-request --business-status "Ready to Collect" --nhs-number 9998481732 -o output.json
generate-psu-request --business-status "Dispatched" --post-dated 24 -o post-dated.json
generate-psu-request --business-status "Collected" --num-entries 5 -o multi.json
```

| Flag                          | Description                            | Default        |
| ----------------------------- | -------------------------------------- | -------------- |
| `--business-status <status>`  | **Required.** See valid statuses below | —              |
| `--order-number <number>`     | Prescription order number              | auto-generated |
| `--order-item-number <uuid>`  | Prescription order item number (UUID)  | auto-generated |
| `--nhs-number <number>`       | Patient NHS number                     | auto-generated |
| `--ods-code <code>`           | ODS organisation code                  | auto-generated |
| `--last-modified <timestamp>` | ISO-8601 UTC timestamp                 | current time   |
| `--post-dated <hours>`        | Hours to post-date                     | —              |
| `--num-entries <count>`       | Number of Task entries                 | 1              |
| `-o, --output <file>`         | Output file path                       | STDOUT         |

Valid business statuses: `With Pharmacy`, `Ready to Collect`, `Ready to Dispatch`, `Dispatched`, `Collected`, `Not Dispensed`

### `send-psu-request`

Sends a PSU FHIR Bundle to the EPS PSU API endpoint.

```bash
send-psu-request --input ./bundle.json
```

### `send-pfp-request`

Fetches Prescriptions-for-Patients bundles via OAuth2.

```bash
send-pfp-request 9998481732
send-pfp-request 9998481732 --save-dir ./data/psu_requests
```

Requires Playwright browsers installed.

### `make-psu-request`

Interactive wizard combining PfP fetch and PSU generation/sending.

| Mode      | Command                                                      | Requirements |
| --------- | ------------------------------------------------------------ | ------------ |
| Synthetic | `make-psu-request --wizard --nhs-number 9991234567`          | No env vars  |
| From File | `make-psu-request --input ./data/pfp_responses/example.json` | No env vars  |
| Live PfP  | `make-psu-request --nhs-number 9991234567 --send`            | PFP env vars |

| Flag                         | Description                      | Default               |
| ---------------------------- | -------------------------------- | --------------------- |
| `-w, --wizard`               | Synthetic-data wizard mode       | false                 |
| `-i, --input <file>`         | Path to PfP response JSON        | —                     |
| `-n, --nhs-number <number>`  | NHS number for PfP fetch         | —                     |
| `--ods-code <code>`          | ODS code override (wizard)       | auto-generated        |
| `--business-status <status>` | Default business status (wizard) | `With Pharmacy`       |
| `-o, --output <file>`        | Write output bundle to file      | —                     |
| `-s, --send`                 | Send the generated bundle        | false                 |
| `--save-dir <dir>`           | Auto-save directory              | `./data/psu_requests` |
