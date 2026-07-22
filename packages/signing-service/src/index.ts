import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { firefox } from "playwright";

const DEFAULT_FIREFOX_TMP_DIR = "./tmp/test_firefox";

export interface DssSigningOptions {
  host: string;
  accessToken: string;
  apiKey: string;
  kid: string;
  privateKey: string;
  sdsUserId: string;
  digests: Array<{ id: string; payload: string }>;
  callbackUrl: string;
  mock?: boolean;
  headless?: boolean;
  userDataDir?: string;
}

export interface DssSignatureResult {
  signatures: Array<{ id: string; signature: string }>;
  certificate: string;
}

function getSigningServiceUrl(host: string): string {
  return `https://${host}/signing-service`;
}

function createSignatureRequestJwt(options: {
  apiKey: string;
  kid: string;
  privateKey: string;
  sdsUserId: string;
  signingServiceUrl: string;
  digests: Array<{ id: string; payload: string }>;
}): string {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: options.apiKey,
      sub: options.sdsUserId,
      aud: options.signingServiceUrl,
      exp: now + 600,
      iat: now,
      algorithm: "RS256",
      payloads: options.digests,
    },
    options.privateKey,
    {
      header: {
        typ: "JWT",
        kid: options.kid,
        alg: "RS512",
      },
    },
  );
}

async function requestSignatures(
  host: string,
  accessToken: string,
  signatureJwt: string,
): Promise<{ token: string; redirectUri: string }> {
  const url = `${getSigningServiceUrl(host)}/signaturerequest`;
  console.log(`DSS Request signatures: ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/plain",
      "X-Request-ID": randomUUID(),
      "X-Correlation-ID": randomUUID(),
    },
    body: signatureJwt,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `DSS signature request failed: ${response.status} ${response.statusText}\n${errorBody}`,
    );
  }

  return (await response.json()) as { token: string; redirectUri: string };
}

async function fetchSignatures(
  host: string,
  accessToken: string,
  dssToken: string,
): Promise<DssSignatureResult> {
  const url = `${getSigningServiceUrl(host)}/signatureresponse/${dssToken}`;
  console.log(`DSS Get signatures: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Request-ID": randomUUID(),
      "X-Correlation-ID": randomUUID(),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `DSS get signatures failed: ${response.status} ${response.statusText}\n${errorBody}`,
    );
  }

  return (await response.json()) as DssSignatureResult;
}

async function performPresenceCheck(
  redirectUri: string,
  callbackUrl: string,
  options?: {
    mock?: boolean;
    headless?: boolean;
    userDataDir?: string;
  },
): Promise<void> {
  const headless =
    options?.headless ??
    (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
  const userDataDir =
    options?.userDataDir ??
    process.env.FIREFOX_TMP_DIR ??
    DEFAULT_FIREFOX_TMP_DIR;

  let targetUri = redirectUri;
  if (options?.mock) {
    const url = new URL(redirectUri);
    url.searchParams.set("mock", "true");
    targetUri = url.toString();
  }

  console.log(`DSS Presence check: navigating to ${targetUri}`);

  const context = await firefox.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 300, height: 300 },
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await context.newPage();
    await page.goto(targetUri);

    // Wait for DSS to redirect back to the callback URL after presence check.
    // Compare hostnames loosely to handle redirects (e.g. google.com → www.google.com).
    const callbackHostname = new URL(callbackUrl).hostname.replace(
      /^www\./,
      "",
    );
    const signingServiceHostname = new URL(redirectUri).hostname;

    await page.waitForURL(
      (url) => {
        const currentHost = url.hostname.replace(/^www\./, "");
        return (
          currentHost !== signingServiceHostname &&
          currentHost === callbackHostname
        );
      },
      { timeout: 60000 },
    );

    console.log("DSS Presence check completed");
  } finally {
    await context.close();
  }
}

/**
 * Sign prescription digest(s) using the NHS Digital Signature Service (DSS).
 *
 * Flow:
 * 1. Create a signed JWT containing the digest payloads
 * 2. POST to /signaturerequest → receive token + redirectUri
 * 3. Perform presence check via browser redirect (skipped for sandbox)
 * 4. GET /signatureresponse/{token} → receive signatures + certificate
 */
export async function signWithDss(
  options: DssSigningOptions,
): Promise<DssSignatureResult> {
  const signingServiceUrl = getSigningServiceUrl(options.host);
  console.log(`DSS Signing Service URL: ${signingServiceUrl}`);

  // Step 1: Create JWT containing the digests to sign
  const signatureJwt = createSignatureRequestJwt({
    apiKey: options.apiKey,
    kid: options.kid,
    privateKey: options.privateKey,
    sdsUserId: options.sdsUserId,
    signingServiceUrl,
    digests: options.digests,
  });

  // Step 2: Request signatures from DSS
  const { token, redirectUri } = await requestSignatures(
    options.host,
    options.accessToken,
    signatureJwt,
  );
  console.log(`DSS Token: ${token}`);
  console.log(`DSS Redirect URI: ${redirectUri}`);

  // Step 3: Perform presence check (browser redirect)
  // For sandbox, the presence check is a no-op — go straight to retrieval
  const isSandbox = options.host.includes("sandbox");
  if (!isSandbox) {
    await performPresenceCheck(redirectUri, options.callbackUrl, {
      mock: options.mock,
      headless: options.headless,
      userDataDir: options.userDataDir,
    });
  } else {
    console.log("DSS Sandbox mode: skipping presence check");
  }

  // Step 4: Retrieve signatures and certificate
  const result = await fetchSignatures(
    options.host,
    options.accessToken,
    token,
  );
  console.log(
    `DSS returned ${result.signatures.length} signature(s) with certificate`,
  );

  return result;
}
