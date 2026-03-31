# ODS Code Generator

Generate ODS (Organisation Data Service) codes following common patterns.

## Installation

```bash
npm install
npm run build
```

## Usage

### As a Library

```typescript
import {generateOdsCode, generateOdsCodes} from "ods-code-generator";

// Generate a single 6-character ODS code
const code = generateOdsCode();

// Generate a 5-character ODS code
const code5 = generateOdsCode(5);

// Generate multiple ODS codes
const codes = generateOdsCodes(10, 6);
```

### As a CLI Tool

```bash
# Generate one ODS code (default 6 characters)
generate-ods-codes

# Generate 5 ODS codes
generate-ods-codes -n 5

# Generate 3 ODS codes of length 4
generate-ods-codes -n 3 -l 4

# See all options
generate-ods-codes --help
```

## ODS Code Patterns

The generator uses these patterns based on observed test data:
- Length 3: LLD (2 letters, 1 digit)
- Length 4: LDDD (1 letter, 3 digits)
- Length 5: LLDDD (2 letters, 3 digits)
- Length 6: LDDDDD (1 letter, 5 digits)

Note: These patterns are based on examples found in test data and may not represent official NHS rules.
