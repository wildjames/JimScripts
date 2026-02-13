import {faker} from "@faker-js/faker";
import {generateNhsNumber as generateNhsNumberImpl} from "nhs-number-generator";
import {generatePrescriptionId as generatePrescriptionIdImpl} from "prescription-id-generator";

export function generateNhsNumber(): string {
  return generateNhsNumberImpl();
}

export function generatePrescriptionId(odsCode?: string): string {
  return generatePrescriptionIdImpl(odsCode);
}

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

export function generateOdsCode(length = 5): string {
  if (length < 3 || length > 6) {
    throw new Error("ODS code length must be between 3 and 6 characters.");
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  const randLetter = () => letters[Math.floor(Math.random() * letters.length)];
  const randDigit = () => digits[Math.floor(Math.random() * digits.length)];

  // ODS code of the format "ANN", "AANNN", or "ANNNNN", where A is an uppercase letter and N is a digit.
  if (length === 3) {
    return randLetter() + randLetter() + randDigit();
  } else if (length === 4) {
    return randLetter() + randDigit() + randDigit() + randDigit();
  } else if (length === 5) {
    return randLetter() + randLetter() + randDigit() + randDigit() + randDigit();
  } else if (length === 6) {
    return randLetter() + randDigit() + randDigit() + randDigit() + randDigit() + randDigit();
  }

  throw new Error("ODS code length must be between 3 and 6 characters.");
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
  // Generate identifiers
  const sdsUser = "555" + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const sdsRole = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
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
