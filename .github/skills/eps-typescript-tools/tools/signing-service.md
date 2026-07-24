# signing-service

NHS Digital Signature Service (DSS) client for signing prescriptions. This is a library-only package (no CLI command).

**Package:** `signing-service`

## Programmatic API

```typescript
import {
  signWithDss,
  type DssSigningOptions,
  type DssSignatureResult,
} from "signing-service";

// Sign digest(s) via NHS Digital Signature Service
const dssResult = await signWithDss({
  host,
  accessToken,
  apiKey,
  kid,
  privateKey,
  sdsUserId: "656005750107",
  digests: [{ id: "payload-1", payload: base64Digest }],
  algorithm: "RS256",
  callbackUrl: "https://google.com",
  mock: false,
});
console.log(dssResult.signatures[0].signature);
console.log(dssResult.certificate); // X509 cert from DSS
```

## DSS Signing Flow

1. Creates a signed JWT containing the digest payload(s)
2. POSTs to `/signing-service/signaturerequest` → receives a token + redirectUri
3. Performs a presence check via browser redirect (skipped on sandbox, mocked with `--dss-mock` in `fhir-prescribing`)
4. GETs `/signing-service/signatureresponse/{token}` → receives signatures + X509 certificate

## Notes

- This library is used internally by `fhir-prescribing --action create --dss`.
- The DSS presence check requires either a smartcard or mock mode.
- The returned X509 certificate is embedded in the Provenance resource.
