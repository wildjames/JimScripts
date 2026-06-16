---
name: eps-typescript-tools
description: "Use when: working on NHS EPS tooling in this repository, including generating NHS numbers or ODS codes, creating/signing/cancelling FHIR prescription bundles, generating/sending PSU bundles, running PfP flows, and checking required auth environment variables."
---

# EPS TypeScript Tools

## Overview

This is an npm workspace monorepo (`packages/`) providing CLI tools for NHS Electronic Prescription Service (EPS) testing. All tools generate or manipulate FHIR-compliant resources.

## Setup

Installation is done as part of the devcontainer build. Re-run only if a command returns "not found" or after editing TypeScript source:

```bash
make install    # Install all dependencies
make build      # Build all packages in dependency order
make link       # Globally link all CLI commands
```

For PfP and user-restricted flows:

```bash
make install-playwright
```

Note that environment variables are required, but not all need to be set for every command. See [Environment Variables](references/environment-variables.md) for details. Assume that all the required variables are set until errors indicate otherwise.

## Quick Reference

| CLI Command                       | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `generate-nhs-numbers`            | Generate/validate NHS numbers                        |
| `generate-ods-codes`              | Generate ODS organisation codes                      |
| `generate-prescription-ids`       | Generate prescription order numbers                  |
| `fhir-create-prescription-bundle` | Create FHIR prescription message bundles             |
| `fhir-prescribing`                | Create, cancel, sign, and submit prescriptions       |
| `sign-prescription`               | Prepare and sign prescriptions via $prepare endpoint |
| `generate-psu-request`            | Generate PSU FHIR bundles                            |
| `send-psu-request`                | Send PSU bundles to PSU API                          |
| `send-pfp-request`                | Fetch Prescriptions-for-Patients bundles             |
| `make-psu-request`                | Interactive wizard: PfP fetch + PSU gen/send         |

For full CLI options and flags, see [Tool Inventory](./references/tool-inventory.md).

## Key Workflows

```bash
# Generate test data
generate-ods-codes -n 5

# Create + submit prescription
fhir-create-prescription-bundle --nhs-number 9998481732 --count 2
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-9998481732.json

# Cancel prescription
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-9998481732.json

# Generate and send PSU
generate-psu-request --business-status "With Pharmacy" -o psu.json
send-psu-request --input psu.json

# Full PfP-to-PSU interactive flow
make-psu-request --nhs-number 9998481732 --send
```

For more workflow examples, see [Workflows](./references/workflows.md).

## Environment Variables

Configuration is via a `.env` file loaded automatically. Assume variables are set until errors indicate otherwise.

Key groups:

- **Prescribing (app-restricted):** `HOST`, `PRESCRIBE_API_KEY`, `PRESCRIBE_KID`, `PRESCRIBE_PRIVATE_KEY`/`PRESCRIBE_PRIVATE_KEY_PATH`
- **Prescribing (user-restricted):** `HOST`, `PRESCRIBE_API_KEY`, `PRESCRIBE_APP_CLIENT_SECRET`, `PRESCRIBE_CALLBACK_URL`, plus private key
- **PSU sending:** `HOST`, `API_KEY`, `PSU_KID`, `PRIVATE_KEY`/`PSU_PRIVATE_KEY_PATH`
- **PfP fetching:** `HOST`, `PFP_API_KEY`, `PFP_CLIENT_SECRET`

Full variable reference: [Environment Variables](./references/environment-variables.md).

## Programmatic APIs

All packages export TypeScript APIs. See [Programmatic APIs](./references/programmatic-apis.md) for import examples.

## Data Directories

| Path                    | Contents                                             |
| ----------------------- | ---------------------------------------------------- |
| `./data/prescriptions/` | Prescription bundles, create bundles, cancel bundles |
| `./data/psu_requests/`  | PSU request bundles and PfP responses                |
| `./data/keys/`          | JWKS key pairs for app-restricted auth               |

## Operating Guidance

1. Prefer the root-linked CLI names available on `PATH`.
2. For commands that write files, state expected output path and filename pattern.
3. For `fhir-prescribing --action create` and `--action cancel`, report both HTTP response status and saved output bundle path.
4. `cancel` is a generate-and-submit workflow, not just a local transform.
5. For failures, capture: command run, key env var presence (not secret values), HTTP status and response body.
6. **Never print private key contents in logs or chat responses.**
7. Valid business statuses: `With Pharmacy`, `Ready to Collect`, `Ready to Dispatch`, `Dispatched`, `Collected`, `Not Dispensed`.

## Done Criteria

A task is complete when:

- Command(s) run successfully (or failure is diagnosed with actionable next steps)
- Output file location is confirmed when relevant
- Required env vars and mode (app-restricted vs user-restricted) are clearly identified
- Any generated command examples are directly runnable in this repo
