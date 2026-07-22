import {sendFhirRequest} from "./http.js";

// https://digital.nhs.uk/developer/api-catalogue/eps-fhir-prescribing-api#post-/FHIR/R4/$prepare

export async function preparePrescription(
  host: string,
  token: string,
  bundle: unknown,
  urid?: string
): Promise<{digest: string; timestamp: string}> {
  const {response} = await sendFhirRequest({
    host,
    path: "/fhir-prescribing/FHIR/R4/$prepare",
    token,
    body: bundle,
    urid
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`$prepare failed: ${response.status} ${response.statusText} ${body}`);
  }

  const parameters = (await response.json()) as {
    resourceType: string;
    parameter: Array<{name: string; valueString: string}>;
  };

  const digestParam = parameters.parameter.find(p => p.name === "digest");
  if (!digestParam) {
    throw new Error("$prepare response missing digest parameter");
  }

  const timestampParam = parameters.parameter.find(p => p.name === "timestamp");

  return {
    digest: digestParam.valueString,
    timestamp: timestampParam?.valueString ?? new Date().toISOString()
  };
}
