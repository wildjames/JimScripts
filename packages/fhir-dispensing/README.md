# FHIR Dispensing

Call EPS FHIR Dispensing endpoint `POST /FHIR/R4/Task/$release` or `POST /FHIR/R4/Task/$release-unattended`.

This package provides:

- a CLI command: `fhir-dispensing`
- a programmatic API to request prescription release from EPS

## Usage

### CLI

Generate an attended release request body automatically with fake organisation and dispenser data:

```bash
fhir-dispensing --prescription-id 24F5DA-A83008-7EFE6Z
```

Use an optional config JSON as the base payload (the CLI still enforces the prescription ID from `--prescription-id`):

```bash
fhir-dispensing --prescription-id 24F5DA-A83008-7EFE6Z --input ./release-parameters.json
```

Use unattended release with application-restricted auth:

```bash
fhir-dispensing --prescription-id 24F5DA-A83008-7EFE6Z --app-restricted
```

Save the downloaded prescription Bundle to a specific directory:

```bash
fhir-dispensing --prescription-id 24F5DA-A83008-7EFE6Z --save-dir ./data/prescriptions
```

Options:

- `--prescription-id <id>`: short-form prescription ID (required)
- `--input <file>`: optional path to request body JSON (FHIR `Parameters` resource)
- `--app-restricted`: use application-restricted auth and call `$release-unattended`; omits `agent` from the request body
- `--save-dir <directory>`: directory to save the downloaded Bundle JSON (default: `./data/prescriptions`)
- `--urid <urid>`: optional `NHSD-Session-URID` override for user-restricted `$release`

On success, the CLI extracts the returned prescription `Bundle` from the EPS `Parameters` response and writes it to disk.
Output file pattern:

```text
./data/prescriptions/release-bundle_<timestamp>_nhs-num-<number>.json
```

If the returned bundle does not contain a patient NHS number, the filename falls back to the prescription ID:

```text
./data/prescriptions/release-bundle_<timestamp>_prescription-id-<id>.json
```

## Environment Variables

Shared:

- `HOST`
- `IS_PR` (optional): set to `true` to target a dispensing PR deployment
- `PR_NUMBER` (required when `IS_PR=true`): PR number used in `/fhir-dispensing-pr-<PR_NUMBER>`

User-restricted mode (default, for `$release`):

- `DISPENSING_API_KEY`
- `DISPENSING_APP_CLIENT_SECRET`
- `DISPENSING_CALLBACK_URL`
- optional:
  - `HEADLESS`
  - `FIREFOX_TMP_DIR`

App-restricted mode (`--app-restricted`, for `$release-unattended`):

- `DISPENSING_API_KEY`
- `DISPENSING_KID`
- one of:
  - `DISPENSING_PRIVATE_KEY`
  - `DISPENSING_PRIVATE_KEY_PATH`

## Generated request body

When `--input` is not supplied, the CLI generates:

- `group-identifier` from `--prescription-id`
- `owner` as a fake pharmacy `Organization`
- `status` as `accepted`
- `agent` as a fake dispenser `PractitionerRole` for user-restricted `$release` only

If `--input` is supplied, the CLI still overwrites `group-identifier` and normalizes `agent` based on the endpoint:

- `$release` keeps an existing `agent` or generates one if missing
- `$release-unattended` removes any `agent` parameter before sending the request

## Input file structure

When `--input` is supplied, the file must be a FHIR `Parameters` JSON document.
The `group-identifier` parameter will be overwritten with the value passed to `--prescription-id`.

For attended `$release`, all four parameters are required by the EPS API:

```json
{
  "resourceType": "Parameters",
  "id": "854b706a-c6e5-11ec-9d64-0242ac120002",
  "parameter": [
    {
      "name": "group-identifier",
      "valueIdentifier": {
        "system": "https://fhir.nhs.uk/Id/prescription-order-number",
        "value": "24F5DA-A83008-7EFE6Z"
      }
    },
    {
      "name": "owner",
      "resource": {
        "resourceType": "Organization",
        "id": "4a964042-3c11-4b0f-990f-22d7b41ad603",
        "identifier": [
          {
            "system": "https://fhir.nhs.uk/Id/ods-organization-code",
            "value": "VNE51"
          }
        ],
        "active": true,
        "type": [
          {
            "coding": [
              {
                "system": "https://fhir.nhs.uk/CodeSystem/organisation-role",
                "code": "182",
                "display": "PHARMACY"
              }
            ]
          }
        ],
        "name": "The Simple Pharmacy",
        "telecom": [
          {
            "system": "phone",
            "use": "work",
            "value": "0113 3180277"
          }
        ],
        "address": [
          {
            "use": "work",
            "type": "both",
            "line": ["17 Austhorpe Road", "Crossgates"],
            "city": "Leeds",
            "district": "West Yorkshire",
            "postalCode": "LS15 8BA"
          }
        ]
      }
    },
    {
      "name": "status",
      "valueCode": "accepted"
    },
    {
      "name": "agent",
      "resource": {
        "resourceType": "PractitionerRole",
        "id": "16708936-6397-4e03-b84f-4aaa790633e0",
        "identifier": [
          {
            "system": "https://fhir.nhs.uk/Id/sds-role-profile-id",
            "value": "555086415105"
          }
        ],
        "practitioner": {
          "identifier": {
            "system": "https://fhir.nhs.uk/Id/sds-user-id",
            "value": "3415870201"
          },
          "display": "Jackie Clark"
        },
        "code": [
          {
            "coding": [
              {
                "system": "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode",
                "code": "R8000",
                "display": "Clinical Practitioner Access Role"
              }
            ]
          }
        ],
        "telecom": [
          {
            "system": "phone",
            "use": "work",
            "value": "02380798431"
          }
        ]
      }
    }
  ]
}
```

### Field reference

| Parameter                                      | Description                                                    |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `group-identifier.valueIdentifier.value`       | Short-form prescription ID; overwritten by `--prescription-id` |
| `owner.resource.identifier[].value`            | ODS code of the dispensing pharmacy                            |
| `owner.resource.name`                          | Organisation name                                              |
| `owner.resource.type[].coding[].code`          | Organisation role code — use `"182"` for PHARMACY              |
| `owner.resource.telecom[].value`               | Organisation phone number                                      |
| `owner.resource.address[].line`                | Street address lines                                           |
| `owner.resource.address[].city`                | City                                                           |
| `owner.resource.address[].postalCode`          | Postal code                                                    |
| `status.valueCode`                             | Must be `"accepted"`                                           |
| `agent.resource.identifier[].value`            | SDS role profile ID of the dispenser                           |
| `agent.resource.practitioner.identifier.value` | SDS user ID of the dispenser                                   |
| `agent.resource.practitioner.display`          | Dispenser display name                                         |
| `agent.resource.code[].coding[].code`          | SDS job role code                                              |
| `agent.resource.telecom[].value`               | Dispenser phone number                                         |

## Programmatic API

```typescript
import { obtainAppRestrictedToken, releaseTask } from "fhir-dispensing";

const token = await obtainAppRestrictedToken({
  host,
  apiKey,
  kid,
  privateKey,
});

const result = await releaseTask({
  host,
  token,
  mode: "unattended",
  body: parameters,
});

console.log(result.response.status, result.responseBody);
```
