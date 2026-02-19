# Jim's scripts

I've made a few helper scripts for doing EPS test stuff.

Most frequently useful is the NHS number generator, but I also have scripts in here for building and sending PSU update bodies based on a PfP response for a patient. More will be added as I need it.

## TypeScript monorepo

The tools in `typescript/` now run as an npm workspace monorepo.

- Install all TypeScript package dependencies once: `make install`
- Build every TypeScript package in dependency order: `make build`
- Link all CLI commands globally from a single place: `make link`

The `link` target links `typescript/package.json`, which exposes all tool binaries centrally:

- `create-prescription-bundle`
- `generate-nhs-numbers`
- `generate-ods-codes`
- `generate-prescription-ids`
- `generate-psu-request`
- `send-psu-request`
- `send-pfp-request`
- `prescription-action`
- `psu-wizard`


# TODO:

This has an example of creating and signing a prescription with the FHIR facade in dev: [here](https://github.com/NHSDigital/electronic-prescription-service-api/blob/master/packages/e2e-tests/services/update-prescriptions.ts) - implement it. It only works in dev though, since it relies on signing using a certificate, and higher environments require use of a smartcard
