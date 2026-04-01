---
name: eps-typescript-tools
description: "Use when: working on NHS EPS tooling in this repository, including generating NHS numbers or ODS codes, creating/signing/cancelling FHIR prescription bundles, generating/sending PSU bundles, running PfP flows, and checking required auth environment variables."
---

# EPS TypeScript Tools Skill

## Purpose

Use this skill to handle requests in the EPS tools monorepo that involve:

- Test data generation (NHS numbers, ODS codes, prescription IDs)
- Prescription bundle generation, signing, submission, and cancellation
- PSU request generation and submission
- PfP retrieval and PfP-to-PSU interactive workflows
- Verifying setup, build, CLI linking, and required environment variables

## Repository Facts

- Workspace root contains `packages/` with one CLI package per tool.
- Canonical package docs live in `AGENTS.md` and each package `README.md`.
- The workspace root `package.json` exposes linked convenience commands
- Generated data is typically written under `data/prescriptions/` and `data/psu_requests/`.
- Configuration is done with a `.env` file that is loaded by the CLI tools automatically. You do not need to check for things being set correctly - just assume they are until errors say otherwise.

## Setup Commands

Installation has most likely already been done. However, if you find that a command is not found, run these commands to install the tools:

```bash
make install
make build
make link
```

Manual alternative:

```bash
cd packages
npm install
npm run build
npm link
```

Playwright (required for PfP and user-restricted login flows):

```bash
make install-playwright
# or: cd packages && npx playwright install
```

## Primary CLI Workflows

### Generate test identifiers

```bash
generate-nhs-numbers -n 10
generate-ods-codes -n 5
generate-prescription-ids -n 3
```

### Create a prescription bundle

```bash
create-prescription-bundle --nhs-number 9998481732 --count 2
```

Expected output pattern:

```bash
./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

### Create and submit a prescription

```bash
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>.json
```

Expected output pattern:

```bash
./data/prescriptions/create-bundle_<timestamp>_nhs-num-<number>.json
```

### Cancel an existing prescription bundle

```bash
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>.json
```

This action generates a cancellation bundle and submits it to EPS.

Expected output pattern:

```bash
./data/prescriptions/cancel-bundle_<timestamp>_nhs-num-<number>.json
```

### Sign only

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle_<timestamp>.json
sign-prescription --input ./data/prescriptions/prescription-bundle_<timestamp>.json --prepare-only
```

### End-to-end create, submit, and cancel

```bash
create-prescription-bundle --count 1
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

### Generate and send PSU

```bash
generate-psu-request --business-status "With Pharmacy" -o psu.json
send-psu-request --input psu.json
```

### PfP to PSU workflow

```bash
make-psu-request --nhs-number 9991234567 --send
```

## Environment Variable Checklist

Before running auth-dependent commands, verify required variables:

- Shared host: `HOST`
- Prescribing app-restricted: `PRESCRIBE_API_KEY`, `PRESCRIBE_KID`, and one of `PRESCRIBE_PRIVATE_KEY` or `PRESCRIBE_PRIVATE_KEY_PATH`
- Prescribing user-restricted: `PRESCRIBE_APP_KEY`, `PRESCRIBE_APP_CLIENT_SECRET`, `PRESCRIBE_CALLBACK_URL`, plus private key var
- PSU sender: `API_KEY`, `PSU_KID`, and one of `PRIVATE_KEY` or `PSU_PRIVATE_KEY_PATH`
- PfP sender: `PFP_API_KEY`, `PFP_CLIENT_SECRET`

## Operating Guidance

1. Prefer package README details if behavior in `AGENTS.md` and implementation differ.
2. For commands that write files, state expected output path and filename pattern.
3. When working from the repo root, prefer the root-linked CLI names that are actually available on `PATH`, even if package docs use a package-local command name.
4. For `fhir-prescribing --action create` and `--action cancel`, report both the HTTP response status and the saved output bundle path.
5. `cancel` is a generate-and-submit workflow in current docs and implementation, not just a local transform.
6. For failures, capture:
   - command run
   - key env var presence (not secret values)
   - HTTP status and response body when available
7. Never print private key contents in logs or chat responses.
8. Keep examples consistent with valid business statuses:
   - `With Pharmacy`
   - `Ready to Collect`
   - `Ready to Dispatch`
   - `Dispatched`
   - `Collected`
   - `Not Dispensed`

## Done Criteria

A task is complete when:

- Command(s) run successfully (or failure is diagnosed with actionable next steps)
- Output file location is confirmed when relevant
- Required env vars and mode (app-restricted vs user-restricted) are clearly identified
- Any generated command examples are directly runnable in this repo
