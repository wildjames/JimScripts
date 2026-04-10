import {randomUUID} from "crypto";
import {obtainBrowserAuthCodeAccessToken} from "eps-auth";

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

export async function getAccessTokenViaAuthCode(
  host: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const username = process.env.AUTH_USERNAME ?? DEFAULT_AUTH_USERNAME;

  console.log(`Using host: ${host}`);
  console.log(`Using client ID: ${clientId}`);
  console.log(`Using redirect URI: ${redirectUri}`);
  console.log(`Using auth username: ${username}`);
  const headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
  console.log(`Launching browser in ${headless ? "headless" : "headed"} mode...`);

  const token = await obtainBrowserAuthCodeAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    username,
    scope: "nhs-login",
    userDataDir: process.env.FIREFOX_TMP_DIR ?? DEFAULT_FIREFOX_TMP_DIR,
    headless
  });

  console.log("Access token obtained successfully: ", token);

  return token;
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
  console.log(`Request endpoint: ${url}`);
  console.log("Using headers:\n", headers);
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
