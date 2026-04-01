import {randomUUID} from "crypto";
import {obtainAppRestrictedAccessToken} from "eps-auth";

export async function obtainAccessToken(
  host: string,
  apiKey: string,
  kid: string,
  privateKey: string
): Promise<string> {
  return obtainAppRestrictedAccessToken({
    host,
    apiKey,
    kid,
    privateKey
  });
}

export async function sendPsu(
  host: string,
  token: string,
  bundle: unknown
): Promise<{response: Response; requestId: string; correlationId: string}> {
  const isPr = (process.env.IS_PR ?? "").trim().toLowerCase() === "true";
  let url = `https://${host}/prescription-status-update/`;

  if (isPr) {
    const prNumber = process.env.PR_NUMBER;
    if (!prNumber) {
      throw new Error("PR_NUMBER must be set when IS_PR is true");
    }
    url = `https://${host}/prescription-status-update-pr-${prNumber}/`;
  }
  console.log(`Sending PSU to ${url}`);

  const requestId = randomUUID();
  const correlationId = randomUUID();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-correlation-id": correlationId
    },
    body: JSON.stringify(bundle)
  });

  return {response, requestId, correlationId};
}
