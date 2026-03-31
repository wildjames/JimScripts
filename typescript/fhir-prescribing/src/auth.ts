import {randomUUID} from "crypto";
import jwt from "jsonwebtoken";

export async function obtainAccessToken(
  host: string,
  apiKey: string,
  kid: string,
  privateKey: string
): Promise<string> {
  const authUrl = `https://${host}/oauth2/token`;
  const now = Math.floor(Date.now() / 1000);

  const assertion = jwt.sign(
    {
      sub: apiKey,
      iss: apiKey,
      jti: randomUUID(),
      aud: authUrl,
      exp: now + 180
    },
    privateKey,
    {
      header: {
        typ: "JWT",
        kid,
        alg: "RS512"
      }
    }
  );

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion
  });

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: form.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token request failed: ${response.status} ${response.statusText} ${errorBody}`);
  }

  const payload = (await response.json()) as {access_token?: string};
  if (!payload.access_token) {
    throw new Error("Token response missing access_token");
  }

  return payload.access_token;
}
