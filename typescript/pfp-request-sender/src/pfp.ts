import {createHash, randomBytes, randomUUID} from "crypto";
import {firefox} from "playwright";

import {getEnv} from "./utils.js";

const DEFAULT_AUTH_USERNAME = "9449304130";
const DEFAULT_REDIRECT_URI = "https://www.google.com/";
const DEFAULT_FIREFOX_TMP_DIR = "./tmp/test_firefox";

export interface PfpEnv {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getPfpEnv(): PfpEnv {
  const host = getEnv("HOST");
  const clientId = getEnv("PFP_API_KEY");
  const clientSecret = getEnv("PFP_CLIENT_SECRET");
  const redirectUri = process.env.REDIRECT_URI ?? DEFAULT_REDIRECT_URI;

  return {host, clientId, clientSecret, redirectUri};
}

export function generatePkcePair(): {codeVerifier: string; codeChallenge: string} {
  const codeVerifier = base64UrlEncode(randomBytes(64));
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest()
  );

  return {codeVerifier, codeChallenge};
}

export async function getAccessTokenViaAuthCode(
  host: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const {codeVerifier, codeChallenge} = generatePkcePair();

  const authUrl = new URL(`https://${host}/oauth2-mock/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "nhs-login");
  authUrl.searchParams.set("state", "state123");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const username = process.env.AUTH_USERNAME ?? DEFAULT_AUTH_USERNAME;
  const headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
  const userDataDir = process.env.FIREFOX_TMP_DIR ?? DEFAULT_FIREFOX_TMP_DIR;

  console.log(`Using host: ${host}`);
  console.log(`Using client ID: ${clientId}`);
  console.log(`Using redirect URI: ${redirectUri}`);
  console.log(`Using auth username: ${username}`);
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
    await page.fill("#username", username);
    await page.keyboard.press("Enter");

    await page.waitForURL(
      (url) => url.toString().startsWith(redirectUri),
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
    throw new Error("no `code` parameter found in the callback URL.");
  }

  console.log("Authorization code obtained, exchanging for access token...");

  const tokenUrl = `https://${host}/oauth2-mock/token`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: "nhs-login",
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
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

  console.log("Access token obtained successfully.", payload.access_token);

  return payload.access_token;
}

export async function fetchBundle(
  host: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  nhsNumber: string
): Promise<Record<string, unknown>> {
  const token = await getAccessTokenViaAuthCode(
    host,
    clientId,
    clientSecret,
    redirectUri
  );

  const url = `https://${host}/prescriptions-for-patients/Bundle`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-request-id": randomUUID(),
    "x-correlation-id": randomUUID(),
    "x-nhs-number": nhsNumber
  }
  console.log(`Fetching PfP Bundle for NHS number ${nhsNumber}...`);
  console.log("Using headers:", headers);
  console.log()

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Bundle request failed: ${response.status} ${response.statusText} ${errorBody}`
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
