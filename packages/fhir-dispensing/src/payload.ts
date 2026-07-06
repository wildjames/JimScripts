import { randomUUID } from "crypto";

import {
  generateOrganization,
  generatePractitionerRole,
} from "data-generators";

export interface ReleaseParameters extends Record<string, unknown> {
  resourceType: "Parameters";
  id: string;
  parameter: Array<Record<string, unknown>>;
}

export interface ReleaseParameterOptions {
  includeAgent: boolean;
  pharmacyOds?: string;
  includeGroupIdentifier?: boolean;
}

function upsertGroupIdentifier(
  rawParameters: Array<Record<string, unknown>>,
  prescriptionId: string,
): void {
  for (let i = rawParameters.length - 1; i >= 0; i--) {
    if (rawParameters[i].name === "group-identifier") {
      rawParameters.splice(i, 1);
    }
  }

  rawParameters.unshift({
    name: "group-identifier",
    valueIdentifier: {
      system: "https://fhir.nhs.uk/Id/prescription-order-number",
      value: prescriptionId,
    },
  });
}

function normalizeAgentParameter(
  rawParameters: Array<Record<string, unknown>>,
  includeAgent: boolean,
): Array<Record<string, unknown>> {
  const parametersWithoutAgent = rawParameters.filter(
    (parameter) => parameter.name !== "agent",
  );

  if (!includeAgent) {
    return parametersWithoutAgent;
  }

  const firstAgent = rawParameters.find(
    (parameter) => parameter.name === "agent",
  );

  return [
    ...parametersWithoutAgent,
    firstAgent ?? { name: "agent", resource: generatePractitionerRole() },
  ];
}

export function generateReleaseParameters(
  prescriptionId: string | undefined,
  options: ReleaseParameterOptions,
): ReleaseParameters {
  const includeGroupIdentifier = options.includeGroupIdentifier ?? true;
  const parameter: Array<Record<string, unknown>> = [];

  if (includeGroupIdentifier && prescriptionId) {
    parameter.push({
      name: "group-identifier",
      valueIdentifier: {
        system: "https://fhir.nhs.uk/Id/prescription-order-number",
        value: prescriptionId,
      },
    });
  }

  parameter.push(
    {
      name: "owner",
      resource: generateOrganization(options.pharmacyOds),
    },
    {
      name: "status",
      valueCode: "accepted",
    },
  );

  if (options.includeAgent) {
    parameter.push({
      name: "agent",
      resource: generatePractitionerRole(),
    });
  }

  return {
    resourceType: "Parameters",
    id: randomUUID(),
    parameter,
  };
}

export function normalizeReleaseParameters(
  parameters: Record<string, unknown>,
  prescriptionId: string | undefined,
  options: ReleaseParameterOptions,
): Record<string, unknown> {
  const includeGroupIdentifier = options.includeGroupIdentifier ?? true;
  const cloned = JSON.parse(JSON.stringify(parameters)) as Record<
    string,
    unknown
  >;
  const rawParameters = cloned.parameter;

  if (!Array.isArray(rawParameters)) {
    return generateReleaseParameters(prescriptionId, options);
  }

  const parameterObjects = rawParameters.filter(
    (parameter): parameter is Record<string, unknown> =>
      typeof parameter === "object" && parameter !== null,
  );

  if (includeGroupIdentifier && prescriptionId) {
    upsertGroupIdentifier(parameterObjects, prescriptionId);
  } else if (!includeGroupIdentifier) {
    // Remove any existing group-identifier for unattended mode
    for (let i = parameterObjects.length - 1; i >= 0; i--) {
      if (parameterObjects[i].name === "group-identifier") {
        parameterObjects.splice(i, 1);
      }
    }
  }
  cloned.parameter = normalizeAgentParameter(
    parameterObjects,
    options.includeAgent,
  );

  return cloned;
}
