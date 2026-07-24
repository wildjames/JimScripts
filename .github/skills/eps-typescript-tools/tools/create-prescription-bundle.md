# create-prescription-bundle

Generates complete FHIR prescription message bundles containing MessageHeader, MedicationRequest(s), Patient, PractitionerRole, Practitioner, and Organization resources.

**Package:** `create-fhir-prescription`

## CLI Usage

```bash
create-prescription-bundle                                # Single prescription, all auto-generated
create-prescription-bundle --count 3 --nhs-number 9998481732  # 3 medication requests for a specific patient
create-prescription-bundle --pharmacy-ods FA565 --practitioner-ods A83008 --count 2
create-prescription-bundle --save-dir /tmp/my-prescriptions
```

## Options

| Flag                        | Description                         | Default                |
| --------------------------- | ----------------------------------- | ---------------------- |
| `--nhs-number <number>`     | Patient NHS number                  | auto-generated         |
| `--pharmacy-ods <code>`     | Pharmacy ODS code                   | auto-generated         |
| `--practitioner-ods <code>` | Practitioner ODS code               | auto-generated         |
| `-n, --count <number>`      | Number of MedicationRequest entries | 1                      |
| `--save-dir <directory>`    | Output directory                    | `./data/prescriptions` |

## Output

Saves a JSON file named `prescription-bundle_<timestamp>_nhs-num-<number>.json` to the save directory.

Auto-generated data includes: NHS numbers (999 prefix), ODS codes, prescription IDs, patient demographics (via Faker.js), and practitioner identifiers (SDS, GMC, DIN).

## Programmatic API

```typescript
import { createPrescriptionMessageBundle } from "prescription-bundle-creator";

const bundle = createPrescriptionMessageBundle({
  nhsNumber: "9998481732",
  count: 2,
  pharmacyOds: "FA565",
  practitionerOds: "A83008",
});
```

## Notes

- No environment variables required.
- The output bundle is used as input for `fhir-prescribing --action create`.
