import {randomUUID} from "crypto";
import {saveJsonPayload} from "./utils.js";

function getDispensingServicePath(): string {
  const isPr = (process.env.IS_PR ?? "").trim().toLowerCase() === "true";
  if (!isPr) {
    return "/fhir-dispensing";
  }

  const prNumber = process.env.PR_NUMBER?.trim();
  if (!prNumber) {
    throw new Error("PR_NUMBER must be set when IS_PR is true");
  }

  return `/fhir-dispensing-pr-${prNumber}`;
}

export interface DispensingRequestOptions {
  host: string;
  token: string;
  endpoint: string;
  body: unknown;
  urid?: string;
  requestSaveDir?: string;
  requestFilePrefix?: string;
}

export interface DispensingRequestResult {
  response: Response;
  requestId: string;
  correlationId: string;
  responseBody: unknown;
}

export async function sendDispensingRequest(
  options: DispensingRequestOptions
): Promise<DispensingRequestResult> {
  const requestId = randomUUID();
  const correlationId = randomUUID();
  const servicePath = getDispensingServicePath();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
    "Content-Type": "application/fhir+json",
    Accept: "application/fhir+json",
    "X-Request-ID": requestId,
    "X-Correlation-ID": correlationId
  };

  if (options.urid) {
    headers["NHSD-Session-URID"] = options.urid;
  }

  const url = `https://${options.host}${servicePath}/FHIR/R4/${options.endpoint}`;
  console.log(`Request endpoint: ${url}`);

  if (options.requestSaveDir) {
    const prefix = options.requestFilePrefix ?? "request";
    const requestOutputPath = saveJsonPayload(
      options.body,
      options.requestSaveDir,
      `${prefix}-${requestId}.json`
    );
    console.log(`Saved request body: ${requestOutputPath}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body)
  });

  let responseBody: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {response, requestId, correlationId, responseBody};
}
