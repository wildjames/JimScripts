# Programmatic APIs

All packages export TypeScript APIs that can be imported directly.

## nhs-number-generator

```typescript
import {
  generateNhsNumber,
  generateNhsNumbers,
  completeNhsNumber,
  validateNhsNumber,
  calculateCheckDigit,
} from "nhs-number-generator";

generateNhsNumber(); // → "9991234560"
generateNhsNumbers(5); // → string[]
completeNhsNumber("999123456"); // → "9991234560"
validateNhsNumber("9991234560"); // → true | false
calculateCheckDigit("999123456"); // → number
```

## ods-code-generator

```typescript
import { generateOdsCode, generateOdsCodes } from "ods-code-generator";

generateOdsCode(); // → "A12345" (6-char default)
generateOdsCode(5); // → "FA565"
generateOdsCodes(10, 6); // → string[] of length 10
```

## prescription-id-generator

```typescript
import {
  generatePrescriptionId,
  generatePrescriptionIds,
  computePrescriptionIdCheckDigit,
} from "prescription-id-generator";

generatePrescriptionId(); // → "ABC123-A12345-DEF45X"
generatePrescriptionIds(5); // → string[]
computePrescriptionIdCheckDigit("ABC123-A12345-DEF45"); // → check digit char
```

## prescription-bundle-creator (create-fhir-prescription)

```typescript
import { createPrescriptionMessageBundle } from "prescription-bundle-creator";

const bundle = createPrescriptionMessageBundle({
  nhsNumber: "9998481732",
  count: 2,
  pharmacyOds: "FA565",
  practitionerOds: "A83008",
});
```

## fhir-prescribing

```typescript
import {
  createAndSubmitPrescription,
  createPrescriptionActionBundle,
  obtainAccessToken,
  preparePrescription,
  signDigest,
} from "fhir-prescribing";

// Create: full flow - prepare, sign, submit
const result = await createAndSubmitPrescription({
  host,
  apiKey,
  kid,
  privateKey,
  bundle: prescriptionBundle,
});
console.log(result.response.status, result.digest, result.signature);

// Cancel: synchronous bundle transformation
const cancellationBundle = createPrescriptionActionBundle({
  action: "cancel",
  inputBundle: existingBundleJson,
});
```

## prescription-signer

```typescript
import {
  obtainAccessToken,
  preparePrescription,
  signDigest,
  prepareAndSign,
} from "prescription-signer";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { digest, signature, timestamp } = await prepareAndSign(
  host,
  token,
  bundle,
  privateKey,
);

// Step by step
const { digest } = await preparePrescription(host, token, bundle, urid);
const signature = signDigest(digest, privateKey, "RSA-SHA1");
```

## psu-request-generator

```typescript
import { generateCreatePrescriptionBundle } from "psu-request-generator";

const bundle = generateCreatePrescriptionBundle({
  businessStatus: "With Pharmacy",
  nhsNumber: "9998481732",
  numEntries: 1,
});
```

## psu-request-sender

```typescript
import { obtainAccessToken, sendPsu } from "psu-request-sender";

const token = await obtainAccessToken(host, apiKey, kid, privateKey);
const { response } = await sendPsu(host, token, bundle);
console.log(response.status);
```

## pfp-request-sender

```typescript
import { fetchBundle, getPfpEnv } from "pfp-request-sender";

const { host, clientId, clientSecret, redirectUri } = getPfpEnv();
const bundle = await fetchBundle(
  host,
  clientId,
  clientSecret,
  redirectUri,
  "9998481732",
);
```

## psu-request-wizard

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
