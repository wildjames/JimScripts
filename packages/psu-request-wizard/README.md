# PSU Request Wizard

Interactive TypeScript wizard that walks users through PSU interactions.

It supports three modes:
- Build synthetic PSU bundles in wizard mode
- Build PSU bundles from a PfP response file
- Fetch PfP by NHS number, then interactively build PSU entries from selected medication requests

## Installation

```bash
npm install
npm run build
```

To use globally:

```bash
npm link
```

This exposes the CLI command `make-psu-request`.

## CLI Usage

```bash
make-psu-request --wizard --nhs-number 9991234567
```

```bash
make-psu-request --input ./data/pfp_responses/example.json
```

```bash
make-psu-request --nhs-number 9991234567 --send
```

## Options

- `-w, --wizard` Run synthetic-data wizard mode.
- `-i, --input <file>` Path to PfP response JSON.
- `-n, --nhs-number <number>` NHS number used for PfP fetch mode.
- `--ods-code <code>` ODS code override for wizard-generated bundle mode.
- `--business-status <status>` Default wizard business status (default: `With Pharmacy`).
- `-c, --clipboard` Copy output to clipboard (falls back to printing; clipboard not implemented).
- `-o, --output <file>` Write output bundle to file.
- `-s, --send` Send bundle to PSU endpoint.
- `--save-dir <dir>` Auto-save directory for generated bundles (default: `./data/psu_requests`).

## Behavior Notes

- Every generated bundle is auto-saved with prefix `psu-request` before final output/send.
- In PfP-based interactive mode, entering an invalid medication selection exits the selection loop.
- Business status selection accepts menu numbers or case-insensitive exact text.

## Development

```bash
npm run build
```
