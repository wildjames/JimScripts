import { randomUUID } from "crypto";

import {
  generateOdsCode,
  generateOrganization,
  generatePractitionerRole,
} from "data-generators";

import { sendDispensingRequest, type DispensingRequestResult } from "./http.js";

/**
 * Valid reason codes from EPS-task-dispense-withdraw-reason CodeSystem.
 * See https://digital.nhs.uk/developer/api-catalogue/eps-fhir-dispensing-api#post-/FHIR/R4/Task-withdraw
 */
export const WITHDRAW_REASON_CODES: Record<string, string> = {
  MU: "Medication Update",
  DA: "Dosage Amendment",
  PA: "Patient Allergy",
  OC: "Other Clinical",
  CS: "Clinical / Significant",
  RE: "Rejected / Expired",
  QU: "Query",
  ONC: "Other Non-Clinical",
};

export interface WithdrawTaskOptions {
  prescriptionId: string;
  reasonCode: string;
  reasonText?: string;
  pharmacyOds?: string;
  nhsNumber?: string;
  dispenseNotificationBundleId?: string;
}

export interface WithdrawRequestOptions {
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

  return [
    {
      ...practitionerRole,
      organization: { reference: "#organisation" },
    },
    {
      ...organization,
      id: "organisation",
    },
  ];
}

export function generateWithdrawTask(
  options: WithdrawTaskOptions,
): Record<string, unknown> {
  const reasonDisplay =
    options.reasonText ??
    WITHDRAW_REASON_CODES[options.reasonCode] ??
    `Withdraw reason ${options.reasonCode}`;

  const taskId = randomUUID();
  const pharmacyOds = options.pharmacyOds ?? generateOdsCode(5);

  const practitionerRole = generateContainedResources(pharmacyOds)[0] as Record<
    string,
    unknown
  >;
  const sdsUserId =
    ((
      (practitionerRole.practitioner as Record<string, unknown>)
        ?.identifier as Record<string, unknown>
    )?.value as string) ?? "7654321";

  const contained = generateContainedResources(pharmacyOds);

  return {
    resourceType: "Task",
    id: taskId,
    contained,
    extension: [
      {
        url: "https://fhir.nhs.uk/StructureDefinition/Extension-Provenance-agent",
        valueReference: {
          identifier: {
            system: "https://fhir.nhs.uk/Id/sds-user-id",
            value: sdsUserId,
          },
        },
      },
    ],
    identifier: [
      {
        system: "https://tools.ietf.org/html/rfc4122",
        value: taskId,
      },
    ],
    groupIdentifier: {
      system: "https://fhir.nhs.uk/Id/prescription-order-number",
      value: options.prescriptionId,
    },
    status: "in-progress",
    statusReason: {
      coding: [
        {
          system:
            "https://fhir.nhs.uk/CodeSystem/EPS-task-dispense-withdraw-reason",
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
          code: "abort",
          display: "Mark the focal resource as no longer active",
        },
      ],
    },
    focus: {
      type: "Bundle",
      identifier: {
        system: "https://tools.ietf.org/html/rfc4122",
        value: options.dispenseNotificationBundleId ?? randomUUID(),
      },
    },
    for: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/nhs-number",
        value: options.nhsNumber ?? "0000000000",
      },
    },
    authoredOn: new Date().toISOString(),
    requester: {
      reference: "#requester",
    },
    owner: {
      identifier: {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: pharmacyOds,
      },
    },
  };
}

export async function withdrawDispenseNotification(
  taskOptions: WithdrawTaskOptions,
  requestOptions: WithdrawRequestOptions,
): Promise<DispensingRequestResult> {
  const body = generateWithdrawTask(taskOptions);

  console.log(
    `Withdrawing dispense notification for prescription ${taskOptions.prescriptionId} with reason code ${taskOptions.reasonCode}`,
  );

  return sendDispensingRequest({
    host: requestOptions.host,
    token: requestOptions.token,
    endpoint: "Task",
    body,
    urid: requestOptions.urid,
    requestSaveDir: requestOptions.requestSaveDir,
    action: "withdraw",
    requestId: requestOptions.requestId,
    correlationId: requestOptions.correlationId,
  });
}
