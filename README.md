# EPS TypeScript Tools

Utilities for NHS EPS testing and message generation, including:

- NHS number, ODS code, and prescription ID generation
- FHIR prescription bundle generation, signing, submission, and cancellation
- FHIR dispensing: release, return, and dispense-notification
- PSU generation and submission
- PfP retrieval and PfP-to-PSU interactive workflows

This repository is an npm workspace monorepo with one TypeScript package per tool.
All CLI tools have a `-h` option to print their usage.

Note that I have added an `AGENTS.md` for vibe-coding new interactions more reliably,
and the repo contains a `SKILL.md` file. You should be able to set up an environment
file, open copilot, and say something like "Create me 10 prescriptions, and tell me
their prescription IDs" and it will do it.

## Setup

Create a `.env` file and populate it:

```bash
export HOST=internal-dev.api.service.nhs.uk

export IS_PR=false
export PR_NUMBER=1234

export PFP_API_KEY=
export PFP_CLIENT_SECRET=

export PRESCRIBE_API_KEY=
export PRESCRIBE_APP_CLIENT_SECRET=
export PRESCRIBE_CALLBACK_URL=
export PRESCRIBE_KID=
export PRESCRIBE_PRIVATE_KEY_PATH=

export DISPENSING_API_KEY=
export DISPENSING_APP_CLIENT_SECRET=
export DISPENSING_CALLBACK_URL=
export DISPENSING_KID=
export DISPENSING_PRIVATE_KEY_PATH=

export PSU_KID=
export PSU_API_KEY=
export PSU_PRIVATE_KEY_PATH=
```

You can create JWKS data with the `generate_DoS_app_keys.sh` script. This also creates the public key URL for you to set in the [Digital Onboarding Service](https://dos-internal.ptl.api.platform.nhs.uk/MyApplications), and you can set the key path in the environment file accordingly.

Remember to give your app the necessary permissions! At time of writing, the onboarding service is bugged in Dev such that it won't show the main branch deployments, so you'll need to do that in [Apigee](https://apigee.com/organizations/nhsd-nonprod/apps) instead.

Then, install and build the tools.
The next few steps should be done automatically by the devcontainer, so it's easier to do that.
From the repository root:

```bash
make install
make link
```

Playwright browsers are installed automatically as part of `make build`. To reinstall manually:

```bash
make install-playwright
```

## Available CLI Commands

| Command                      | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `generate-nhs-numbers`       | Generate/validate NHS numbers                                     |
| `generate-data`              | Generate ODS codes, FHIR Organizations, PractitionerRoles         |
| `generate-prescription-ids`  | Generate prescription order numbers                               |
| `create-prescription-bundle` | Create FHIR prescription message bundles                          |
| `fhir-prescribing`           | Create, cancel, and sign prescriptions (user-restricted auth)     |
| `fhir-dispensing`            | Release, return, and dispense prescriptions                       |
| `generate-psu-request`       | Generate PSU FHIR bundles                                         |
| `send-psu-request`           | Send PSU bundles to the PSU API endpoint                          |
| `send-pfp-request`           | Fetch Prescriptions-for-Patients bundles via OAuth2               |
| `psu-wizard`                 | Interactive wizard combining PfP fetch and PSU generation/sending |

## Quick Start: create, release, dispense

End-to-end flow for a single test prescription:

1. Generate a prescription bundle
2. Create the prescription via `fhir-prescribing`
3. Release the prescription via `fhir-dispensing`
4. Send a dispense-notification via `fhir-dispensing`

```bash
# 1) Generate one prescription bundle
create-prescription-bundle --count 1

# Resolve the newest generated bundle file
BUNDLE_FILE="$(ls -1t data/prescriptions/prescription-bundle_* | head -n 1)"

# 2) Create (prepare, sign, submit)
fhir-prescribing --action create --input "$BUNDLE_FILE"

# Extract the prescription ID from the create response
CREATE_RESPONSE="$(ls -1t data/prescriptions/*_create_response.json | head -n 1)"
PRESCRIPTION_ID="$(jq -r '.entry[].resource | select(.resourceType=="MedicationRequest") | .groupIdentifier.value' "$CREATE_RESPONSE" | head -1)"

# 3) Release the prescription
fhir-dispensing --action release --prescription-id "$PRESCRIPTION_ID"

# Resolve the release bundle
RELEASE_BUNDLE="$(ls -1t data/prescriptions/release-bundle_* | head -n 1)"

# 4) Send dispense-notification
fhir-dispensing --action dispense --prescription-id "$PRESCRIPTION_ID" --input "$RELEASE_BUNDLE"
```

## Quick Start: create, PSU update, cancel

```bash
# 1) Generate one prescription bundle
create-prescription-bundle --count 1
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

## Tool Usage

### Generate test identifiers

```bash
generate-nhs-numbers -n 10
generate-data --type ods -n 5
generate-prescription-ids -n 3
```

### Generate test FHIR resources

```bash
generate-data --type organization
generate-data --type practitioner-role -n 3
```

### Create a prescription bundle

```bash
create-prescription-bundle --nhs-number 9998481732 --count 2
```

Output file pattern:

```text
./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

### Create (prepare, sign, submit) a prescription

```bash
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

Output files:

```text
./data/prescriptions/<timestamp>_create_request.json
./data/prescriptions/<timestamp>_create_response.json
```

### Cancel an existing prescription

```bash
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
fhir-prescribing --action cancel --input ./bundle.json --cancel-reason-type 0003
```

Output files:

```text
./data/prescriptions/<timestamp>_cancel_request.json
./data/prescriptions/<timestamp>_cancel_response.json
```

### Prepare and sign only

```bash
fhir-prescribing --action sign --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
fhir-prescribing --action sign --input ./bundle.json --prepare-only
```

### Release a prescription

```bash
fhir-dispensing --action release --prescription-id 24F5DA-A83008-7EFE6Z
fhir-dispensing --action release --prescription-id 24F5DA-A83008-7EFE6Z --app-restricted
```

### Return a prescription

```bash
fhir-dispensing --action return --prescription-id 24F5DA-A83008-7EFE6Z --reason-code 0001
```

### Send a dispense-notification

```bash
fhir-dispensing --action dispense --prescription-id 24F5DA-A83008-7EFE6Z --input ./data/prescriptions/release-bundle_*.json
```

### Generate and send a PSU request

```bash
generate-psu-request --business-status "With Pharmacy" -o psu.json
send-psu-request --input psu.json
```

### PfP to PSU interactive workflow

```bash
psu-wizard --nhs-number 9991234567 --send
```

## Environment Variables

### Shared

- `HOST` — API host (e.g. `internal-dev.api.service.nhs.uk`)

### fhir-prescribing (user-restricted)

- `PRESCRIBE_API_KEY` — OAuth client ID
- `PRESCRIBE_APP_CLIENT_SECRET` — OAuth client secret
- `PRESCRIBE_CALLBACK_URL` — OAuth callback URL
- one of:
  - `PRESCRIBE_PRIVATE_KEY` — PEM private key contents for digest signing
  - `PRESCRIBE_PRIVATE_KEY_PATH` — path to PEM file
- optional:
  - `HEADLESS` — set `false` to show browser during login
  - `FIREFOX_TMP_DIR` — browser profile directory

### fhir-dispensing (user-restricted, default)

- `DISPENSING_API_KEY` — OAuth client ID
- `DISPENSING_APP_CLIENT_SECRET` — OAuth client secret
- `DISPENSING_CALLBACK_URL` — OAuth callback URL
- optional:
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

### fhir-dispensing (app-restricted, `--app-restricted`)

- `DISPENSING_API_KEY` — APIM application API key
- `DISPENSING_KID` — Key ID from APIM portal
- one of:
  - `DISPENSING_PRIVATE_KEY`
  - `DISPENSING_PRIVATE_KEY_PATH`

### send-psu-request and psu-wizard

- `PSU_API_KEY` — APIM application API key
- `PSU_KID` — Key ID from APIM portal
- one of:
  - `PSU_PRIVATE_KEY` — PEM private key contents
  - `PSU_PRIVATE_KEY_PATH` — path to PEM file
- optional:
  - `IS_PR` — set to `true` to target a PR sandbox URL
  - `PR_NUMBER` — PR number when `IS_PR=true`

### send-pfp-request and psu-wizard

- `PFP_API_KEY` — OAuth client ID
- `PFP_CLIENT_SECRET` — OAuth client secret
- optional:
  - `REDIRECT_URI` — OAuth redirect URI
  - `AUTH_USERNAME` — Mock NHS login username
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

## Default Data Directories

- `./data/prescriptions` — prescription bundles, release bundles, and cancellation bundles
- `./data/psu_requests` — PSU requests and PfP responses
- `./data/keys` — JWKS key material
