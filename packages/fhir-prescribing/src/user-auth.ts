import {createHash, randomBytes} from "crypto";
import {firefox} from "playwright";

const DEFAULT_FIREFOX_TMP_DIR = "./tmp/test_firefox";

export type Cis2UserType = "prescriber" | "dispenser";

export const CIS2_USERS: Record<Cis2UserType, {userId: string; roleId: string}> = {
  prescriber: {userId: "656005750107", roleId: "555254242105"},
  dispenser: {userId: "555260695103", roleId: "555265434108"}
};

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

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generatePkcePair(): {codeVerifier: string; codeChallenge: string} {
  const codeVerifier = base64UrlEncode(randomBytes(64));
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest()
  );
  return {codeVerifier, codeChallenge};
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
  options: UserRestrictedAuthOptions
): Promise<UserRestrictedAuthResult> {
  const {
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
    headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false",
    userDataDir = process.env.FIREFOX_TMP_DIR ?? DEFAULT_FIREFOX_TMP_DIR
  } = options;

  const cis2User = CIS2_USERS[userType];
  const {codeVerifier, codeChallenge} = generatePkcePair();

  const authUrl = new URL(`https://${host}/oauth2-mock/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "nhs-cis2");
  authUrl.searchParams.set("state", "state123");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(`Using host: ${host}`);
  console.log(`Using client ID: ${clientId}`);
  console.log(`Using redirect URI: ${redirectUri}`);
  console.log(`Using CIS2 user type: ${userType} (${cis2User.userId})`);
  console.log(`Launching browser in ${headless ? "headless" : "headed"} mode...`);

  const context = await firefox.launchPersistentContext(userDataDir, {
    headless,
    viewport: {width: 300, height: 300},
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
  });

  let redirectResponse = "";

  try {
    const page = await context.newPage();
    await page.goto(authUrl.toString());
    await page.waitForSelector("#username", {timeout: 20000});
    await page.fill("#username", cis2User.userId);
    await page.keyboard.press("Enter");

    await page.waitForURL(
      (url) => {
        const s = url.toString();
        return s.startsWith(redirectUri) || s.includes("code=");
      },
      {timeout: 20000}
    );
    redirectResponse = page.url();
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

  console.log("Authorization code obtained, exchanging for access token...");

  const tokenUrl = `https://${host}/oauth2-mock/token`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: "nhs-cis2",
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: form.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token request failed: ${response.status} ${response.statusText} ${errorBody}`
    );
  }

  const payload = (await response.json()) as {access_token?: string};
  if (!payload.access_token) {
    throw new Error("Token response missing access_token");
  }

  console.log("User-restricted access token obtained successfully.");

  return {
    accessToken: payload.access_token,
    urid: cis2User.roleId
  };
}
