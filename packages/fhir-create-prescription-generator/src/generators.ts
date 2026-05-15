import {faker} from "@faker-js/faker";
import {CIS2_USERS} from "eps-auth";
import {generateNhsNumber} from "nhs-number-utils";
import {generatePrescriptionId} from "prescription-id-generator";
import {generateOdsCode} from "ods-code-generator";

export {generateNhsNumber, generatePrescriptionId, generateOdsCode};

interface PatientData {
  prefix: string;
  given: string[];
  family: string;
  gender: 'male' | 'female';
  birthDate: string;
  address: string[];
  postalCode: string;
}

interface PractitionerData {
  prefix: string;
  given: string[];
  family: string;
  identifiers: {
    sdsUserId: string;
    sdsRoleId: string;
    gmcNumber: string;
    dinNumber: string;
  };
  phone: string;
  odsCode: string;
}

export function generatePatientData(): PatientData {
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';

  let first: string;
  let prefix: string;

  if (gender === 'male') {
    first = faker.person.firstName('male');
    prefix = 'Mr';
  } else {
    first = faker.person.firstName('female');
    const prefixes = ['Ms', 'Mrs', 'Miss'];
    prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  }

  const last = faker.person.lastName().toUpperCase();

  // Generate birthdate between 18 and 90 years ago
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 90);

  const birthDate = faker.date.between({from: minDate, to: maxDate}).toISOString().split('T')[0];

  const street = faker.location.streetAddress().toUpperCase();
  const city = faker.location.city().toUpperCase();
  const county = faker.location.county().toUpperCase();
  const postalCode = faker.location.zipCode('??# #??').toUpperCase();

  return {
    prefix,
    given: [first.toUpperCase()],
    family: last,
    gender,
    birthDate,
    address: [street, city, county],
    postalCode
  };
}

export function generatePractitionerData(ods?: string): PractitionerData {
  // Use the known CIS2 mock prescriber identifiers so bundles pass Spine validation
  const {userId: sdsUser, roleId: sdsRole} = CIS2_USERS.prescriber;
  const gmcNumber = "C" + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const dinNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  return {
    prefix: 'Dr',
    given: [faker.person.firstName().toUpperCase()],
    family: faker.person.lastName().toUpperCase(),
    identifiers: {
      sdsUserId: sdsUser,
      sdsRoleId: sdsRole,
      gmcNumber: gmcNumber,
      dinNumber: dinNumber
    },
    phone: faker.phone.number(),
    odsCode: ods || generateOdsCode(6)
  };
}

export type {PatientData, PractitionerData};
