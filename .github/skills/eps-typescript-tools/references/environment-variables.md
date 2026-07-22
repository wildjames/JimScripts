# Environment Variables

Configuration is done with a `.env` file that is loaded by the CLI tools automatically. Assume variables are set correctly until errors indicate otherwise.

## Variable Reference

| Variable                       | Used By                                                                                                                | Description                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `HOST`                         | `fhir-prescribing`, `fhir-dispensing`, `sign-prescription`, `send-psu-request`, `send-pfp-request`, `make-psu-request` | API host (e.g. `internal-dev.api.service.nhs.uk`)                        |
| `PRESCRIBE_API_KEY`            | `fhir-prescribing`, `sign-prescription`                                                                                | APIM app API key (app-restricted) / OAuth client ID (user-restricted)    |
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

## Required Variables by Action

### Prescribing (app-restricted mode)

- `HOST`
- `PRESCRIBE_API_KEY`
- `PRESCRIBE_KID`
- One of: `PRESCRIBE_PRIVATE_KEY` or `PRESCRIBE_PRIVATE_KEY_PATH`

### Prescribing (user-restricted mode)

- `HOST`
- `PRESCRIBE_API_KEY`
- `PRESCRIBE_APP_CLIENT_SECRET`
- `PRESCRIBE_CALLBACK_URL`
- One of: `PRESCRIBE_PRIVATE_KEY` or `PRESCRIBE_PRIVATE_KEY_PATH`

### Prescribing with DSS signing (additional)

- `PRESCRIBE_KID` (required for DSS JWT)
- `DSS_CALLBACK_URL` (optional, falls back to `PRESCRIBE_CALLBACK_URL`)

### Dispensing (user-restricted mode, default)

- `HOST`
- `DISPENSING_API_KEY`
- `DISPENSING_APP_CLIENT_SECRET`
- `DISPENSING_CALLBACK_URL`

### Dispensing (app-restricted mode, `--app-restricted`)

- `HOST`
- `DISPENSING_API_KEY`
- `DISPENSING_KID`
- One of: `DISPENSING_PRIVATE_KEY` or `DISPENSING_PRIVATE_KEY_PATH`

### PSU Sending

- `HOST`
- `API_KEY`
- `PSU_KID`
- One of: `PRIVATE_KEY` or `PSU_PRIVATE_KEY_PATH`

### PfP Fetching

- `HOST`
- `PFP_API_KEY`
- `PFP_CLIENT_SECRET`
