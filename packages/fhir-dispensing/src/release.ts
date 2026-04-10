import {randomUUID} from "crypto";
import {
  obtainAppRestrictedAccessToken,
  obtainUserRestrictedAccessToken,
  type Cis2UserType
} from "eps-auth";
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

export interface AppRestrictedReleaseAuthOptions {
  host: string;
  apiKey: string;
  kid: string;
  privateKey: string;
}

export interface UserRestrictedReleaseAuthOptions {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userType: Cis2UserType;
}

export interface ReleaseTaskOptions {
  host: string;
  token: string;
  body: unknown;
  mode?: "attended" | "unattended";
  urid?: string;
  requestSaveDir?: string;
}

export interface BundleLike {
  resourceType: "Bundle";
  entry?: Array<{
    resource?: {
      resourceType?: string;
      identifier?: Array<{value?: string}>;
    };
  }>;
}

export interface ReleaseTaskResult {
  response: Response;
  requestId: string;
  correlationId: string;
  responseBody: unknown;
}

export async function obtainAppRestrictedToken(
  options: AppRestrictedReleaseAuthOptions
): Promise<string> {
  return obtainAppRestrictedAccessToken({
    host: options.host,
    apiKey: options.apiKey,
    kid: options.kid,
    privateKey: options.privateKey
  });
}

export async function obtainUserRestrictedToken(
  options: UserRestrictedReleaseAuthOptions
): Promise<{accessToken: string; urid: string}> {
  const result = await obtainUserRestrictedAccessToken({
    host: options.host,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    userType: options.userType
  });

  return {
    accessToken: result.accessToken,
    urid: result.urid
  };
}

export async function releaseTask(options: ReleaseTaskOptions): Promise<ReleaseTaskResult> {
  const requestId = randomUUID();
  const correlationId = randomUUID();
  const mode = options.mode ?? "attended";
  const endpoint = mode === "unattended" ? "$release-unattended" : "$release";
  const servicePath = getDispensingServicePath();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
    "Content-Type": "application/fhir+json",
    Accept: "application/fhir+json",
    "X-Request-ID": requestId,
    "X-Correlation-ID": correlationId
  };

  if (mode === "attended" && options.urid) {
    headers["NHSD-Session-URID"] = options.urid;
  }

  const url = `https://${options.host}${servicePath}/FHIR/R4/Task/${endpoint}`;
  console.log(`Request endpoint: ${url}`);

  if (options.requestSaveDir) {
    const requestOutputPath = saveJsonPayload(
      options.body,
      options.requestSaveDir,
      `release-request-${requestId}.json`
    );
    console.log(`Saved request body: ${requestOutputPath}`);
  }

  const response = await fetch(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(options.body)
    }
  );

  let responseBody: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {
    response,
    requestId,
    correlationId,
    responseBody
  };
}

export function extractReleasedBundle(responseBody: unknown): BundleLike | undefined {
  if (!responseBody || typeof responseBody !== "object") {
    return undefined;
  }

  const resource = responseBody as {
    resourceType?: string;
    parameter?: Array<{name?: string; resource?: unknown}>;
  };

  if (resource.resourceType === "Bundle") {
    return resource as BundleLike;
  }

  if (resource.resourceType !== "Parameters" || !Array.isArray(resource.parameter)) {
    return undefined;
  }

  for (const parameter of resource.parameter) {
    if (
      (parameter.name === "passedPrescriptions" || parameter.name === "prescription") &&
      parameter.resource &&
      typeof parameter.resource === "object" &&
      (parameter.resource as {resourceType?: string}).resourceType === "Bundle"
    ) {
      return parameter.resource as BundleLike;
    }
  }

  return undefined;
}
