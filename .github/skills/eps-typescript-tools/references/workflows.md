# Common Workflows

## Workflow 1: Generate Test Data

```bash
generate-nhs-numbers -n 10
generate-ods-codes -n 5
generate-prescription-ids -n 3
```

## Workflow 2: Create and Submit a Prescription

```bash
# Step 1: Create a prescription bundle
create-prescription-bundle --nhs-number 9998481732 --count 2

# Step 2: Submit it (requires prescribing env vars)
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-9998481732.json
```

Output: `./data/prescriptions/create-bundle_<timestamp>_nhs-num-<number>.json`

## Workflow 3: Cancel a Prescription

```bash
# Cancel an existing prescription bundle
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-9998481732.json
```

Output: `./data/prescriptions/cancel-bundle_<timestamp>_nhs-num-<number>.json`

## Workflow 4: End-to-End Create + Cancel

```bash
create-prescription-bundle --count 1
fhir-prescribing --action create --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
fhir-prescribing --action cancel --input ./data/prescriptions/prescription-bundle_<timestamp>_nhs-num-<number>.json
```

## Workflow 5: Generate and Send PSU

```bash
# Step 1: Generate a PSU bundle
generate-psu-request --business-status "With Pharmacy" --nhs-number 9998481732 -o psu.json

# Step 2: Send it (requires PSU env vars)
send-psu-request --input psu.json
```

## Workflow 6: Full PfP-to-PSU Flow (Interactive)

```bash
# Combines PfP fetch + interactive PSU building + sending
# Requires env vars for both PfP and PSU sending
make-psu-request --nhs-number 9998481732 --send
```

## Workflow 7: Sign Only (No Submit)

```bash
sign-prescription --input ./data/prescriptions/prescription-bundle_<timestamp>.json
sign-prescription --input ./bundle.json --prepare-only  # digest only, no signature
```

## Data Directories

| Path                    | Contents                                             |
| ----------------------- | ---------------------------------------------------- |
| `./data/prescriptions/` | Prescription bundles, create bundles, cancel bundles |
| `./data/psu_requests/`  | PSU request bundles and PfP responses                |
| `./data/keys/`          | JWKS key pairs for app-restricted authentication     |
