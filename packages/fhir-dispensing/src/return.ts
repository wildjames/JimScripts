import { randomUUID } from "crypto";

import {
  generateOdsCode,
  generateOrganization,
  generatePractitionerRole,
} from "data-generators";

import { sendDispensingRequest, type DispensingRequestResult } from "./http.js";

/**
 * Valid reason codes from EPS-task-dispense-return-status-reason CodeSystem.
 * See https://digital.nhs.uk/developer/api-catalogue/eps-fhir-dispensing-api#post-/FHIR/R4/Task-return
 */
export const RETURN_REASON_CODES: Record<string, string> = {
  "0001": "Patient not present",
  "0002": "Patient identity could not be verified",
  "0003": "Patient requested release",
  "0004": "Another dispenser requested release on behalf of the patient",
  "0005": "Prescription otherwise unable to be dispensed",
  "0006": "Prescription expired",
  "0007": "Prescription cancelled",
  "0008": "Prescription not found",
  "0009": "Prescription item was not available",
};

export interface ReturnTaskOptions {
  prescriptionId: string;
  reasonCode: string;
  reasonText?: string;
  pharmacyOds?: string;
}

export interface ReturnRequestOptions {
  host: string;
  token: string;
  urid?: string;
  requestSaveDir?: string;
  requestId?: string;
  correlationId?: string;
}

function generateContainedResources(
  pharmacyOds?: string,
): Array<Record<string, unknown>> {
  const practitionerRole = generatePractitionerRole({
    id: "requester",
    sdsJobRoleCode: "S0030:G0100:R0620",
  });

  const organization = generateOrganization(pharmacyOds);

  // Add organization reference to practitioner role
  return [
    {
      ...practitionerRole,
      organization: { reference: "#organization" },
    },
    {
      ...organization,
      id: "organization",
    },
  ];
}

export function generateReturnTask(
  options: ReturnTaskOptions,
): Record<string, unknown> {
  const reasonDisplay =
    options.reasonText ??
    RETURN_REASON_CODES[options.reasonCode] ??
    `Return reason ${options.reasonCode}`;

  const taskId = randomUUID();

  return {
    resourceType: "Task",
    id: taskId,
    contained: generateContainedResources(options.pharmacyOds),
    identifier: [
      {
        system: "https://tools.ietf.org/html/rfc4122",
        value: taskId,
      },
    ],
    status: "rejected",
    statusReason: {
      coding: [
        {
          system:
            "https://fhir.nhs.uk/CodeSystem/EPS-task-dispense-return-status-reason",
          code: options.reasonCode,
          display: reasonDisplay,
        },
      ],
    },
    intent: "order",
    code: {
      coding: [
        {
          system: "http://hl7.org/fhir/CodeSystem/task-code",
          code: "fulfill",
          display: "Fulfill the focal request",
        },
      ],
    },
    groupIdentifier: {
      system: "https://fhir.nhs.uk/Id/prescription-order-number",
      value: options.prescriptionId,
    },
    authoredOn: new Date().toISOString(),
    focus: {
      identifier: {
        system: "https://tools.ietf.org/html/rfc4122",
        value: randomUUID(),
      },
    },
    for: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/nhs-number",
        value: "0000000000",
      },
    },
    requester: {
      reference: "#requester",
    },
    owner: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: options.pharmacyOds ?? generateOdsCode(5),
      },
    },
  };
}

export async function returnPrescription(
  taskOptions: ReturnTaskOptions,
  requestOptions: ReturnRequestOptions,
): Promise<DispensingRequestResult> {
  const body = generateReturnTask(taskOptions);

  console.log(
    `Returning prescription ${taskOptions.prescriptionId} with reason code ${taskOptions.reasonCode}`,
  );

  return sendDispensingRequest({
    host: requestOptions.host,
    token: requestOptions.token,
    endpoint: "Task",
    body,
    urid: requestOptions.urid,
    requestSaveDir: requestOptions.requestSaveDir,
    action: "return",
    requestId: requestOptions.requestId,
    correlationId: requestOptions.correlationId,
  });
}
