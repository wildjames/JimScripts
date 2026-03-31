export const SUPPORTED_ACTIONS = [
  "create",
  "cancel"
] as const;

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

export interface CreatePrescriptionResult {
  digest: string;
  signature: string;
  timestamp: string;
  response: {
    status: number;
    statusText: string;
    body: unknown;
  };
  signedBundle: BundleLike;
  requestId: string;
  correlationId: string;
}
