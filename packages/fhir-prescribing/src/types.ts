export const SUPPORTED_ACTIONS = [
  "create",
  "cancel",
  "sign"
] as const;

export interface PrepareResult {
  digest: string;
  timestamp: string;
}

export interface SignResult {
  digest: string;
  signature: string;
  timestamp: string;
}

export type PrescriptionAction = (typeof SUPPORTED_ACTIONS)[number];

export interface BundleLike {
  resourceType?: string;
  id?: string;
  identifier?: {
    system?: string;
    value?: string;
  };
  type?: string;
  entry?: Array<{
    fullUrl?: string;
    resource?: {
      resourceType?: string;
      eventCoding?: {
        system?: string;
        code?: string;
        display?: string;
      };
      focus?: unknown[];
      status?: string;
      statusReason?: unknown;
      identifier?: Array<{system?: string; value?: string}>;
    };
  }>;
}

export interface CreatePrescriptionFlowOptions {
  host: string;
  apiKey: string;
  kid: string;
  privateKey: string;
  bundle: BundleLike;
  urid?: string;
  algorithm?: string;
}

export interface CreatePrescriptionUserRestrictedOptions {
  host: string;
  token: string;
  privateKey: string;
  bundle: BundleLike;
  urid?: string;
  algorithm?: string;
}

export interface CreatePrescriptionResult {
  response: {
    status: number;
    statusText: string;
    body: unknown;
  };
  requestId: string;
  correlationId: string;
}

export interface SubmitCancellationOptions {
  host: string;
  token: string;
  bundle: BundleLike;
  urid?: string;
  cancellationReasonType?: "0001" | "0002" | "0003" | "0004";
}

export interface SubmitCancellationResult {
  response: {
    status: number;
    statusText: string;
    body: unknown;
  };
  cancellationBundle: BundleLike;
  requestId: string;
  correlationId: string;
}
