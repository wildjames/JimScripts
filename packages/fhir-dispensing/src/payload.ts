import {randomUUID} from "crypto";

import {faker} from "@faker-js/faker";
import {generateOdsCode} from "ods-code-generator";

export interface ReleaseParameters extends Record<string, unknown> {
  resourceType: "Parameters";
  id: string;
  parameter: Array<Record<string, unknown>>;
}

export interface ReleaseParameterOptions {
  includeAgent: boolean;
}

function generateOrganization(): Record<string, unknown> {
  const odsCode = generateOdsCode(5);
  const city = faker.location.city();

  return {
    resourceType: "Organization",
    id: randomUUID(),
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: odsCode
      }
    ],
    active: true,
    type: [
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/organisation-role",
            code: "182",
            display: "PHARMACY"
          }
        ]
      }
    ],
    name: `${faker.person.lastName()} Pharmacy`,
    telecom: [
      {
        system: "phone",
        value: faker.phone.number({style: "international"}),
        use: "work"
      }
    ],
    address: [
      {
        use: "work",
        type: "both",
        line: [faker.location.streetAddress(), faker.location.secondaryAddress()],
        city,
        district: faker.location.county(),
        postalCode: faker.location.zipCode("??# #??")
      }
    ]
  };
}

function generateAgent(): Record<string, unknown> {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    resourceType: "PractitionerRole",
    id: randomUUID(),
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/sds-role-profile-id",
        value: `555${faker.number.int({min: 100000000, max: 999999999})}`
      }
    ],
    practitioner: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/sds-user-id",
        value: `${faker.number.int({min: 1000000000, max: 9999999999})}`
      },
      display: `${firstName} ${lastName}`
    },
    code: [
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode",
            code: "R8000",
            display: "Clinical Practitioner Access Role"
          }
        ]
      }
    ],
    telecom: [
      {
        system: "phone",
        value: faker.phone.number({style: "international"}),
        use: "work"
      }
    ]
  };
}

function upsertGroupIdentifier(
  rawParameters: Array<Record<string, unknown>>,
  prescriptionId: string
): void {
  const groupIdentifier = rawParameters.find(
    parameter => parameter.name === "group-identifier"
  ) as {valueIdentifier?: {system?: string; value?: string}} | undefined;

  if (!groupIdentifier) {
    rawParameters.unshift({
      name: "group-identifier",
      valueIdentifier: {
        system: "https://fhir.nhs.uk/Id/prescription-order-number",
        value: prescriptionId
      }
    });

    return;
  }

  groupIdentifier.valueIdentifier = {
    system: "https://fhir.nhs.uk/Id/prescription-order-number",
    value: prescriptionId
  };
}

function normalizeAgentParameter(
  rawParameters: Array<Record<string, unknown>>,
  includeAgent: boolean
): Array<Record<string, unknown>> {
  const parametersWithoutAgent = rawParameters.filter(
    parameter => parameter.name !== "agent"
  );

  if (!includeAgent) {
    return parametersWithoutAgent;
  }

  const existingAgent = rawParameters.find(
    parameter => parameter.name === "agent"
  );

  if (existingAgent) {
    return rawParameters;
  }

  return [
    ...parametersWithoutAgent,
    {
      name: "agent",
      resource: generateAgent()
    }
  ];
}

export function generateReleaseParameters(
  prescriptionId: string,
  options: ReleaseParameterOptions
): ReleaseParameters {
  const parameter: Array<Record<string, unknown>> = [
    {
      name: "group-identifier",
      valueIdentifier: {
        system: "https://fhir.nhs.uk/Id/prescription-order-number",
        value: prescriptionId
      }
    },
    {
      name: "owner",
      resource: generateOrganization()
    },
    {
      name: "status",
      valueCode: "accepted"
    }
  ];

  if (options.includeAgent) {
    parameter.push({
      name: "agent",
      resource: generateAgent()
    });
  }

  return {
    resourceType: "Parameters",
    id: randomUUID(),
    parameter
  };
}

export function normalizeReleaseParameters(
  parameters: Record<string, unknown>,
  prescriptionId: string,
  options: ReleaseParameterOptions
): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(parameters)) as Record<string, unknown>;
  const rawParameters = cloned.parameter;

  if (!Array.isArray(rawParameters)) {
    return generateReleaseParameters(prescriptionId, options);
  }

  const parameterObjects = rawParameters.filter(
    (parameter): parameter is Record<string, unknown> =>
      typeof parameter === "object" && parameter !== null
  );

  upsertGroupIdentifier(parameterObjects, prescriptionId);
  cloned.parameter = normalizeAgentParameter(parameterObjects, options.includeAgent);

  return cloned;
}
