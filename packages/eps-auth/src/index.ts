import { createHash, randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { firefox } from "playwright";

const DEFAULT_FIREFOX_TMP_DIR = "./tmp/test_firefox";

export type Cis2UserType = "prescriber" | "dispenser";

export const CIS2_USERS: Record<
  Cis2UserType,
  { userId: string; roleId: string }
> = {
  // TODO: These are currently hardcoded to specific values that work with the NHS oauth2-mock.
  // These are pre-defined test credentials. I don't know how (or even if) these can be made, assigned, whatever,
  // so I'm just going to hardcode them. If that ever becomes a problem, this record will need to be made configurable.
  prescriber: { userId: "656005750107", roleId: "555254242105" },
  dispenser: { userId: "555260695103", roleId: "555265434108" },
};

export interface AppRestrictedAuthOptions {
  host: string;
  apiKey: string;
  kid: string;
  privateKey: string;
  tokenPath?: string;
  algorithm?: "RS512" | "RS384" | "RS256";
  ttlSeconds?: number;
}

export async function obtainAppRestrictedAccessToken(
  options: AppRestrictedAuthOptions,
): Promise<string> {
  const {
    host,
    apiKey,
    kid,
    privateKey,
    tokenPath = "/oauth2/token",
    algorithm = "RS512",
    ttlSeconds = 180,
  } = options;

  const authUrl = `https://${host}${tokenPath}`;
  const now = Math.floor(Date.now() / 1000);

  const assertion = jwt.sign(
    {
      sub: apiKey,
      iss: apiKey,
      jti: randomUUID(),
      aud: authUrl,
      exp: now + ttlSeconds,
    },
    privateKey,
    {
      header: {
        typ: "JWT",
        kid,
        alg: algorithm,
      },
    },
  );

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  console.log(`Request endpoint: ${authUrl}`);
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token request failed: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Token response missing access_token");
  }

  return payload.access_token;
}

export interface BrowserAuthCodeOptions {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  username: string;
  scope: string;
  headless?: boolean;
  userDataDir?: string;
  authorizePath?: string;
  tokenPath?: string;
  allowCodeInAnyUrl?: boolean;
}

export async function obtainBrowserAuthCodeAccessToken(
  options: BrowserAuthCodeOptions,
): Promise<string> {
  const {
    host,
    clientId,
    clientSecret,
    redirectUri,
    username,
    scope,
    headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false",
    userDataDir = process.env.FIREFOX_TMP_DIR ?? DEFAULT_FIREFOX_TMP_DIR,
    authorizePath = "/oauth2-mock/authorize",
    tokenPath = "/oauth2-mock/token",
    allowCodeInAnyUrl = false,
  } = options;

  const { codeVerifier, codeChallenge } = generatePkcePair();

  // For the state, use a random UUID.
  // TODO: This should ideally be checked in the response to prevent CSRF
  const state = randomUUID();

  const authUrl = new URL(`https://${host}${authorizePath}`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(
    `Launching browser to perform auth flow at: ${authUrl.toString()}`,
  );

  const context = await firefox.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 300, height: 300 },
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  let redirectResponse = "";

  // Auth flow script. If this auth suddenly stops working, this is almost certainly why!
  try {
    const page = await context.newPage();
    await page.goto(authUrl.toString());
    await page.waitForSelector("#username", { timeout: 20000 });
    await page.fill("#username", username);
    await page.keyboard.press("Enter");

    await page.waitForURL(
      (url) => {
        const currentUrl = url.toString();
        return (
          currentUrl.startsWith(redirectUri) ||
          (allowCodeInAnyUrl && currentUrl.includes("code="))
        );
      },
      { timeout: 20000 },
    );

    redirectResponse = page.url();
  } catch (error) {
    console.error("Error during auth flow:", error);

    // Save the current page for debugging
    const page = context.pages()[0];
    if (page) {
      const screenshotPath = `./tmp/auth_flow_error_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      console.error(
        `Saved screenshot of the error state to: ${screenshotPath}`,
      );
    }

    throw error;
  } finally {
    await context.close();
  }

  if (!redirectResponse) {
    throw new Error("No redirect URL captured from the auth flow.");
  }

  const callbackUrl = new URL(redirectResponse);
  const code = callbackUrl.searchParams.get("code");
  if (!code) {
    throw new Error("No `code` parameter found in the callback URL.");
  }

  const tokenUrl = `https://${host}${tokenPath}`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  console.log(`Request endpoint: ${tokenUrl}`);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token request failed: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Token response missing access_token");
  }

  return payload.access_token;
}

export interface Cis2UserRestrictedAuthOptions {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userType: Cis2UserType;
  headless?: boolean;
  userDataDir?: string;
}

export interface Cis2UserRestrictedAuthResult {
  accessToken: string;
  urid: string;
}

export async function obtainCis2UserRestrictedAccessToken(
  options: Cis2UserRestrictedAuthOptions,
): Promise<Cis2UserRestrictedAuthResult> {
  const cis2User = CIS2_USERS[options.userType];

  const accessToken = await obtainBrowserAuthCodeAccessToken({
    host: options.host,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    username: cis2User.userId,
    scope: "nhs-cis2",
    headless: options.headless,
    userDataDir: options.userDataDir,
    allowCodeInAnyUrl: true,
  });

  return {
    accessToken,
    urid: cis2User.roleId,
  };
}

function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(randomBytes(64));
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge };
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export interface UserRestrictedAuthOptions {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userType: Cis2UserType;
  headless?: boolean;
  userDataDir?: string;
}

export interface UserRestrictedAuthResult {
  accessToken: string;
  urid: string;
}

/**
 * Obtain an access token via the OAuth2 authorization-code flow
 * against the NHS oauth2-mock, using CIS2 (Care Identity Service 2)
 * credentials automated through Playwright.
 *
 * This mirrors the Python `get_eps_fhir_authenticator` from the
 * regression-tests repository but implemented natively in TypeScript.
 */
export async function obtainUserRestrictedAccessToken(
  options: UserRestrictedAuthOptions,
): Promise<UserRestrictedAuthResult> {
  const { host, clientId, clientSecret, redirectUri, userType } = options;
  const cis2User = CIS2_USERS[userType];
  const headless =
    options.headless ??
    (process.env.HEADLESS ?? "true").toLowerCase() !== "false";

  console.log(`Using host: ${host}`);
  console.log(`Using client ID: ${clientId}`);
  console.log(`Using redirect URI: ${redirectUri}`);
  console.log(`Using CIS2 user type: ${userType} (${cis2User.userId})`);
  console.log(
    `Launching browser in ${headless ? "headless" : "headed"} mode...`,
  );

  const result = await obtainCis2UserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
    headless: options.headless,
    userDataDir: options.userDataDir,
  });

  console.log("User-restricted access token obtained successfully.");

  return result;
}
