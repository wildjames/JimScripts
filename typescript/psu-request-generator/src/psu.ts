const BUSINESS_STATUS_CHOICES = [
  "With Pharmacy",
  "With Pharmacy - Preparing Remainder",
  "Ready to Collect",
  "Ready to Collect - Partial",
  "Collected",
  "Ready to Dispatch",
  "Ready to Dispatch - PartialDispatched",
  "Not Dispensed"
] as const;

const TERMINAL_STATUSES = new Set(["Collected", "Dispatched", "Not Dispensed"]);

export type BusinessStatus = (typeof BUSINESS_STATUS_CHOICES)[number];

export interface Bundle {
  resourceType: "Bundle";
  type: "transaction";
  entry: PsuEntry[];
}

export interface PsuEntry {
  fullUrl: string;
  resource: TaskResource;
  request: {
    method: "POST";
    url: "Task";
  };
}

export interface TaskResource {
  resourceType: "Task";
  id: string;
  basedOn: Array<{
    identifier: {
      system: "https://fhir.nhs.uk/Id/prescription-order-number";
      value: string;
    };
  }>;
  status: "completed" | "in-progress";
  businessStatus: {
    coding: Array<{
      system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt";
      code: BusinessStatus;
    }>;
  };
  intent: "order";
  focus: {
    identifier: {
      system: "https://fhir.nhs.uk/Id/prescription-order-item-number";
      value: string;
    };
  };
  for: {
    identifier: {
      system: "https://fhir.nhs.uk/Id/nhs-number";
      value: string;
    };
  };
  lastModified: string;
  owner: {
    identifier: {
      system: "https://fhir.nhs.uk/Id/ods-organization-code";
      value: string;
    };
  };
  meta?: {
    lastUpdated: string;
  };
}

export function canonicalBusinessStatus(raw: string): BusinessStatus {
  const normalized = raw.trim().toLowerCase();
  const match = BUSINESS_STATUS_CHOICES.find(
    (choice) => choice.toLowerCase() === normalized
  );

  if (!match) {
    throw new Error(
      `Invalid business status '${raw}'. Choose from: ${BUSINESS_STATUS_CHOICES.join(
        ", "
      )}`
    );
  }

  return match;
}

export function buildPsuEntry(params: {
  businessStatus: string;
  orderNumber: string;
  orderItemNumber: string;
  nhsNumber: string;
  odsCode: string;
  lastModified?: string;
  postDatedTimestamp?: string | null;
  taskId: string;
}): PsuEntry {
  const businessStatus = canonicalBusinessStatus(params.businessStatus);
  const status = TERMINAL_STATUSES.has(businessStatus) ? "completed" : "in-progress";

  const entry: PsuEntry = {
    fullUrl: `urn:uuid:${params.taskId}`,
    resource: {
      resourceType: "Task",
      id: params.taskId,
      basedOn: [
        {
          identifier: {
            system: "https://fhir.nhs.uk/Id/prescription-order-number",
            value: params.orderNumber
          }
        }
      ],
      status,
      businessStatus: {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
            code: businessStatus
          }
        ]
      },
      intent: "order",
      focus: {
        identifier: {
          system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
          value: params.orderItemNumber
        }
      },
      for: {
        identifier: {
          system: "https://fhir.nhs.uk/Id/nhs-number",
          value: params.nhsNumber
        }
      },
      lastModified: params.lastModified ?? new Date().toISOString(),
      owner: {
        identifier: {
          system: "https://fhir.nhs.uk/Id/ods-organization-code",
          value: params.odsCode
        }
      }
    },
    request: {
      method: "POST",
      url: "Task"
    }
  };

  if (params.postDatedTimestamp) {
    entry.resource.meta = {
      lastUpdated: params.postDatedTimestamp
    };
  }

  return entry;
}

export function buildPsuBundle(entries: PsuEntry[]): Bundle {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries
  };
}
