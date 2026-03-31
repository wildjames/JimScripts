# Prescription Bundle Creator

Generate FHIR prescription message bundles for NHS electronic prescriptions.

This TypeScript package provides both a CLI tool and a programmatic API for creating FHIR-compliant prescription bundles that match the Python implementation in this repository.

## Installation

```bash
npm install
npm run build
```

## Usage

### As a CLI tool

```bash
create-prescription-bundle [options]
```

**Options:**
- `--nhs-number <number>` - Patient's NHS number (auto-generated if not provided)
- `--pharmacy-ods <code>` - Pharmacy ODS organization code (auto-generated if not provided)
- `--practitioner-ods <code>` - Practitioner ODS organization code (auto-generated if not provided)
- `-n, --count <number>` - Number of medication requests to create (default: 1)
- `--save-dir <directory>` - Directory to save the FHIR Bundle JSON (default: `./data/prescriptions`)
- `-h, --help` - Display help

**Examples:**

```bash
# Generate a single prescription with auto-generated NHS number
create-prescription-bundle

# Generate 3 prescriptions for a specific patient
create-prescription-bundle --count 3 --nhs-number 9998481732

# Specify pharmacy and practitioner ODS codes
create-prescription-bundle \
  --pharmacy-ods FA565 \
  --practitioner-ods A83008 \
  --count 2

# Save to a custom directory
create-prescription-bundle --save-dir /tmp/my-prescriptions
```

### As a library

```typescript
import {createPrescriptionMessageBundle} from 'prescription-bundle-creator';

const bundle = createPrescriptionMessageBundle({
  nhsNumber: '9998481732',
  count: 2,
  pharmacyOds: 'FA565',
  practitionerOds: 'A83008'
});

console.log(JSON.stringify(bundle, null, 2));
```

## Generated Bundle Structure

The generated FHIR Bundle contains:
- 1 MessageHeader resource
- N MedicationRequest resources (where N = count)
- 1 Patient resource
- 1 PractitionerRole resource
- 1 Practitioner resource
- 1 Organization resource

Each MedicationRequest includes:
- Medication coding from SNOMED CT
- Dosage instructions
- Dispense request with validity period
- Prescription IDs and order numbers

## Data Generation

The package automatically generates:
- **NHS Numbers**: Valid 10-digit NHS numbers with correct check digits (using '999' prefix for test data)
- **ODS Codes**: Organizational Data Service codes for pharmacies and practices
- **Prescription IDs**: Valid prescription order numbers with check digits
- **Patient Data**: Realistic demographic data using Faker.js
- **Practitioner Data**: GP details including identifiers (SDS, GMC, DIN)

## License

MIT
