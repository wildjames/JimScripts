import {createSign, randomUUID} from "crypto";
import jwt from "jsonwebtoken";

export interface PrepareResult {
  digest: string;
  timestamp: string;
}

export interface SignResult {
  digest: string;
  signature: string;
  timestamp: string;
}

export async function obtainAccessToken(
  host: string,
  apiKey: string,
  kid: string,
  privateKey: string
): Promise<string> {
  const authUrl = `https://${host}/oauth2/token`;
  const now = Math.floor(Date.now() / 1000);

  const assertion = jwt.sign(
    {
      sub: apiKey,
      iss: apiKey,
      jti: randomUUID(),
      aud: authUrl,
      exp: now + 180
    },
    privateKey,
    {
      header: {
        typ: "JWT",
        kid,
        alg: "RS512"
      }
    }
  );

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion
  });

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token request failed: ${response.status} ${response.statusText} ${errorBody}`);
  }

  const payload = (await response.json()) as {access_token?: string};
  if (!payload.access_token) {
    throw new Error("Token response missing access_token");
  }

  return payload.access_token;
}

export async function preparePrescription(
  host: string,
  token: string,
  bundle: unknown,
  urid?: string
): Promise<PrepareResult> {
  const requestId = randomUUID();
  const correlationId = randomUUID();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/fhir+json",
    Accept: "application/fhir+json",
    "X-Request-ID": requestId,
    "X-Correlation-ID": correlationId
  };

  if (urid) {
    headers["NHSD-Session-URID"] = urid;
  }

  const url = `https://${host}/fhir-prescribing/FHIR/R4/$prepare`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(bundle)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`$prepare failed: ${response.status} ${response.statusText} ${body}`);
  }

  const parameters = (await response.json()) as {
    resourceType: string;
    parameter: Array<{name: string; valueString: string}>;
  };

  const digestParam = parameters.parameter.find(p => p.name === "digest");
  if (!digestParam) {
    throw new Error("$prepare response missing digest parameter");
  }

  return {
    digest: digestParam.valueString,
    timestamp: new Date().toISOString()
  };
}

export function signDigest(
  digest: string,
  privateKey: string,
  algorithm = "RSA-SHA1"
): string {
  const digestBytes = Buffer.from(digest, "base64");
  const signer = createSign(algorithm);
  signer.update(digestBytes);
  return signer.sign(privateKey, "base64");
}

export async function prepareAndSign(
  host: string,
  token: string,
  bundle: unknown,
  privateKey: string,
  urid?: string,
  algorithm?: string
): Promise<SignResult> {
  const {digest, timestamp} = await preparePrescription(host, token, bundle, urid);
  const signature = signDigest(digest, privateKey, algorithm);
  return {digest, signature, timestamp};
}
