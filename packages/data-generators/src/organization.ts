import {randomUUID} from "crypto";

// TODO: Remove the faker dependency
import {faker} from "@faker-js/faker";

import {generateOdsCode} from "./ods.js";

export interface OrganizationData {
  resourceType: "Organization";
  id: string;
  identifier: Array<{system: string; value: string}>;
  active: boolean;
  type: Array<{coding: Array<{system: string; code: string; display: string}>}>;
  name: string;
  telecom: Array<{system: string; value: string; use: string}>;
  address: Array<Record<string, unknown>>;
}

export function generateOrganization(odsCode?: string): OrganizationData {
  const resolvedOds = odsCode ?? generateOdsCode(5);
  const city = faker.location.city();

  return {
    resourceType: "Organization",
    id: randomUUID(),
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: resolvedOds
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
