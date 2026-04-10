import {randomUUID} from "crypto";

function resolveServicePath(path: string): string {
  const isPr = (process.env.IS_PR ?? "").trim().toLowerCase() === "true";
  if (!isPr) {
    return path;
  }

  const prNumber = process.env.PR_NUMBER?.trim();
  if (!prNumber) {
    throw new Error("PR_NUMBER must be set when IS_PR is true");
  }

  return path.replace("/fhir-prescribing/", `/fhir-prescribing-pr-${prNumber}/`);
}

export interface FhirRequestOptions {
  host: string;
  path: string;
  token: string;
  body: unknown;
  urid?: string;
}

export interface FhirRequestResult {
  response: Response;
  requestId: string;
  correlationId: string;
}

export async function sendFhirRequest(options: FhirRequestOptions): Promise<FhirRequestResult> {
  const {host, path, token, body, urid} = options;
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

  const url = `https://${host}${resolveServicePath(path)}`;
  console.log(`Request endpoint: ${url}`);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  return {response, requestId, correlationId};
}
