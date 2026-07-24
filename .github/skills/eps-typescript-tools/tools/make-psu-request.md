# make-psu-request

Interactive wizard that combines PfP fetching, PSU bundle generation, and optional sending. Three modes of operation.

**Package:** `psu-request-wizard`

## Modes

| Flags Present                       | Mode      | Requirements          |
| ----------------------------------- | --------- | --------------------- |
| `--wizard`                          | Synthetic | No env vars needed    |
| `--input <file>`                    | From File | No env vars needed    |
| `--nhs-number` (without `--wizard`) | Live PfP  | PFP env vars required |

## CLI Usage

### Mode 1: Synthetic Wizard

Build PSU bundles with fully synthetic data interactively:

```bash
make-psu-request --wizard --nhs-number 9991234567
```

### Mode 2: From PfP File

Build PSU bundles from a previously saved PfP response file:

```bash
make-psu-request --input ./data/pfp_responses/example.json
```

### Mode 3: Live PfP Fetch

Fetch PfP by NHS number, then interactively select medication requests to build PSU entries:

```bash
make-psu-request --nhs-number 9991234567
make-psu-request --nhs-number 9991234567 --send
```

## Options

| Flag                         | Description                      | Default               |
| ---------------------------- | -------------------------------- | --------------------- |
| `-w, --wizard`               | Run synthetic-data wizard mode   | false                 |
| `-i, --input <file>`         | Path to PfP response JSON        | —                     |
| `-n, --nhs-number <number>`  | NHS number for PfP fetch mode    | —                     |
| `--ods-code <code>`          | ODS code override (wizard mode)  | auto-generated        |
| `--business-status <status>` | Default business status (wizard) | `With Pharmacy`       |
| `-o, --output <file>`        | Write output bundle to file      | —                     |
| `-s, --send`                 | Send the generated bundle        | false                 |
| `--save-dir <dir>`           | Auto-save directory              | `./data/psu_requests` |

## Environment Variables

For Live PfP mode, requires PFP env vars (`HOST`, `PFP_API_KEY`, `PFP_CLIENT_SECRET`).

For sending (`--send`), additionally requires PSU env vars (`API_KEY`, `PSU_KID`, `PRIVATE_KEY`/`PSU_PRIVATE_KEY_PATH`).

## Programmatic API

```typescript
import { runWizard } from "psu-request-wizard";

await runWizard({
  wizard: true,
  nhsNumber: "9991234567",
  businessStatus: "With Pharmacy",
  clipboard: false,
  send: false,
  saveDir: "./data/psu_requests",
});
```

## Notes

- All generated bundles are auto-saved with a `psu-request` prefix before final output/send.
- In PfP-based interactive mode, entering an invalid medication selection exits the selection loop.
- Business status selection accepts menu numbers or case-insensitive exact text.
