# generate-ods-codes

Generates Organisation Data Service (ODS) codes following observed NHS patterns.

**Package:** `ods-code-generator`

## CLI Usage

```bash
generate-ods-codes                # One 6-character code
generate-ods-codes -n 5           # Five 6-character codes
generate-ods-codes -n 3 -l 4     # Three 4-character codes
```

## Options

| Flag                    | Description                | Default |
| ----------------------- | -------------------------- | ------- |
| `-n, --count <number>`  | How many codes to generate | 1       |
| `-l, --length <number>` | Character length (3–6)     | 6       |

## Pattern Rules

| Length | Pattern | Example  |
| ------ | ------- | -------- |
| 3      | LLD     | `AB3`    |
| 4      | LDDD    | `A123`   |
| 5      | LLDDD   | `FA565`  |
| 6      | LDDDDD  | `A83008` |

## Programmatic API

```typescript
import { generateOdsCode, generateOdsCodes } from "ods-code-generator";

generateOdsCode(); // → "A12345" (6-char default)
generateOdsCode(5); // → "FA565"
generateOdsCodes(10, 6); // → string[] of length 10
```

## Notes

- No environment variables required.
