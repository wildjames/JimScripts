import {
  CIS2_USERS,
  obtainCis2UserRestrictedAccessToken,
  type Cis2UserType
} from "eps-auth";

export {CIS2_USERS};
export type {Cis2UserType};

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
  options: UserRestrictedAuthOptions
): Promise<UserRestrictedAuthResult> {
  const {host, clientId, clientSecret, redirectUri, userType} = options;
  const cis2User = CIS2_USERS[userType];
  const headless = options.headless ?? (process.env.HEADLESS ?? "true").toLowerCase() !== "false";

  console.log(`Using host: ${host}`);
  console.log(`Using client ID: ${clientId}`);
  console.log(`Using redirect URI: ${redirectUri}`);
  console.log(`Using CIS2 user type: ${userType} (${cis2User.userId})`);
  console.log(`Launching browser in ${headless ? "headless" : "headed"} mode...`);

  const result = await obtainCis2UserRestrictedAccessToken({
    host,
    clientId,
    clientSecret,
    redirectUri,
    userType,
    headless: options.headless,
    userDataDir: options.userDataDir
  });

  console.log("User-restricted access token obtained successfully.");

  return result;
}
