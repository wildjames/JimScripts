import {randomUUID} from "crypto";

// TODO: Remove the faker dependency
import {faker} from "@faker-js/faker";

export interface PractitionerRoleData {
  resourceType: "PractitionerRole";
  id: string;
  identifier: Array<{system: string; value: string}>;
  practitioner: {
    identifier: {system: string; value: string};
    display: string;
  };
  code: Array<{coding: Array<{system: string; code: string; display?: string}>}>;
  telecom: Array<{system: string; value: string; use: string}>;
}

export interface PractitionerRoleOptions {
  id?: string;
  sdsJobRoleCode?: string;
  sdsJobRoleDisplay?: string;
}

export function generatePractitionerRole(options?: PractitionerRoleOptions): PractitionerRoleData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    resourceType: "PractitionerRole",
    id: options?.id ?? randomUUID(),
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/sds-role-profile-id",
        value: `555${faker.number.int({min: 100000000, max: 999999999})}`
      }
    ],
    practitioner: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/sds-user-id",
        value: `${faker.number.int({min: 1000000, max: 9999999})}`
      },
      display: `${firstName} ${lastName}`
    },
    code: [
      {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/NHSDigital-SDS-JobRoleCode",
            code: options?.sdsJobRoleCode ?? "R8000",
            display: options?.sdsJobRoleDisplay ?? "Clinical Practitioner Access Role"
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
