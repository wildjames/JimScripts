# EPS TypeScript Tools

Utilities for NHS EPS testing and message generation, including:

- NHS number, ODS code, and prescription ID generation
- FHIR prescription bundle generation, signing, submission, and cancellation
- PSU generation and submission
- PfP retrieval and PfP-to-PSU interactive workflows

This repository is an npm workspace monorepo with one TypeScript package per tool. All cli tools have a `-h` option to print their usage.

## Setup

From the repository root:

```bash
make install
make build
make link
```

For PfP and user-restricted browser login flows, install Playwright browsers:

```bash
make install-playwright
# or: cd packages && npx playwright install
```

## Available CLI Commands

- `generate-nhs-numbers`
- `generate-ods-codes`
- `generate-prescription-ids`
- `create-prescription-bundle`
- `fhir-dispensing`
- `fhir-prescribing`
- `sign-prescription`
- `generate-psu-request`
- `send-psu-request`
- `send-pfp-request`
- `make-psu-request`

## Quick Start: create, update, cancel

This is an example end-to-end flow for a single test prescription:

1. Generate a prescription bundle
2. Create the prescription in the FHIR facade, with the `fhir-prescribing` tool
3. Send a PSU update with business status `With Pharmacy`
4. Cancel the prescription with the FHIR facade

Notes:

- PSU updates represent status and can be submitted whether or not the prescription was previously created on the server.
- This flow still performs create first, then PSU, then cancel.

```bash
# 1) Generate one prescription bundle
create-prescription-bundle --count 1

# Resolve the newest generated bundle file
BUNDLE_FILE="$(ls -1t data/prescriptions/prescription-bundle_* | head -n 1)"

# 2) Create (prepare, sign, submit)
fhir-prescribing --action create --input "$BUNDLE_FILE"

# Extract NHS number from filename pattern: ..._nhs-num-<nhs>.json
NHS_NUMBER="$(basename "$BUNDLE_FILE" | sed -E 's/.*_nhs-num-([0-9]{10})\.json/\1/')"

# 3) Generate and submit PSU update: With Pharmacy
generate-psu-request --business-status "With Pharmacy" --nhs-number "$NHS_NUMBER" -o /tmp/psu-with-pharmacy.json
send-psu-request --input /tmp/psu-with-pharmacy.json

# 4) Cancel the original prescription bundle
fhir-prescribing --action cancel --input "$BUNDLE_FILE"
```

## Quick start: Tool usage

### 1) Generate test identifiers

```bash
generate-nhs-numbers -n 10
generate-ods-codes -n 5
generate-prescription-ids -n 3
```

### 2) Create a prescription bundle

```bash
create-prescription-bundle --nhs-number 9998481732 --count 2
```

Output file pattern:

```text
./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

### 3) Create (prepare, sign, submit) a prescription

```bash
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

Output file pattern:

```text
./data/prescriptions/create-bundle_<timestamp>_nhs-num-<number>.json
```

### 4) Cancel an existing prescription

```bash
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json --cancel-reason-type 0003
```

Output file pattern:

```text
./data/prescriptions/cancel-bundle_<timestamp>_nhs-num-<number>.json
```

### 5) Prepare/sign only

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
sign-prescription --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json --prepare-only
```

### 6) Generate and send a PSU request

```bash
generate-psu-request --business-status "With Pharmacy" -o psu.json
send-psu-request --input psu.json
```

### 7) PfP to PSU interactive workflow

```bash
make-psu-request --nhs-number 9991234567 --send
```

## Environment Variables

### Shared

- `HOST`

### fhir-prescribing and sign-prescription (app-restricted)

- `PRESCRIBE_API_KEY`
- `PRESCRIBE_KID`
- one of:
  - `PRESCRIBE_PRIVATE_KEY`
  - `PRESCRIBE_PRIVATE_KEY_PATH`

### fhir-prescribing and sign-prescription (user-restricted)

- `PRESCRIBE_API_KEY`
- `PRESCRIBE_APP_CLIENT_SECRET`
- `PRESCRIBE_CALLBACK_URL`
- one of:
  - `PRESCRIBE_PRIVATE_KEY`
  - `PRESCRIBE_PRIVATE_KEY_PATH`
- optional:
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

### fhir-dispensing (default user-restricted)

- `DISPENSING_API_KEY`
- `DISPENSING_KID`
- one of:
  - `DISPENSING_PRIVATE_KEY`
  - `DISPENSING_PRIVATE_KEY_PATH`

### fhir-dispensing (app-restricted)

- `DISPENSING_API_KEY`
- `DISPENSING_APP_CLIENT_SECRET`
- `DISPENSING_CALLBACK_URL`
- optional:
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

### send-psu-request and make-psu-request

- `API_KEY`
- `PSU_KID`
- one of:
  - `PRIVATE_KEY`
  - `PSU_PRIVATE_KEY_PATH`
- optional:
  - `IS_PR`
  - `PR_NUMBER`

### send-pfp-request and make-psu-request

- `PFP_API_KEY`
- `PFP_CLIENT_SECRET`
- optional:
  - `REDIRECT_URI`
  - `AUTH_USERNAME`
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

## Default Data Directories

- `./data/prescriptions`: prescription bundles and cancellation bundles
- `./data/psu_requests`: PSU requests and PfP responses
- `./data/keys`: JWKS key material
