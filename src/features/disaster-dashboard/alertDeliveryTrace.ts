import type {
  FieldLinkDeliveredAlert,
} from "../../http-api/fieldlink-api";

export type AlertDeliveryClassification =
  | "FIRELINE_APPROACH"
  | "GENERAL_ALERT";

export type AlertDeliveryStatus =
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "FAILED";

export type AlertDeliveryTrace = {
  traceId: string;

  sourceAlertId: string;

  classification:
    AlertDeliveryClassification;

  alertType: string;

  title: string;

  detectedAt:
    string | null;

  attemptedAt: string;

  sentAt:
    string | null;

  deliveryId:
    string | null;

  recipients: number;

  acknowledged: number;

  successRatePct:
    number | null;

  deliveryStatus:
    AlertDeliveryStatus;

  source: string;

  error:
    string | null;
};

export type AlertDescriptor = {
  sourceAlertId: string;

  alertType?: string;

  title?: string;

  message?: string;

  detectedAt?:
    string | null;
};

function safeCount(
  value: unknown,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
}

function safePercent(
  value: unknown,
) {
  if (
    value == null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      parsed,
    ),
  );
}

function normalizedText(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase();
}

export function isFirelineApproachAlert(
  alert: {
    alertType?: unknown;
    title?: unknown;
    message?: unknown;
  },
) {
  const combined = [
    alert.alertType,
    alert.title,
    alert.message,
  ]
    .map(normalizedText)
    .join(" ");

  const referencesFireline =
    combined.includes(
      "FIRELINE",
    ) ||
    combined.includes(
      "FIRE LINE",
    ) ||
    combined.includes(
      "화선",
    );

  const referencesApproach =
    combined.includes(
      "APPROACH",
    ) ||
    combined.includes(
      "PROXIMITY",
    ) ||
    combined.includes(
      "ENTERING",
    ) ||
    combined.includes(
      "접근",
    ) ||
    combined.includes(
      "진입",
    );

  return (
    referencesFireline &&
    referencesApproach
  );
}

export function classifyAlert(
  descriptor:
    AlertDescriptor,
): AlertDeliveryClassification {
  return isFirelineApproachAlert({
    alertType:
      descriptor.alertType,

    title:
      descriptor.title,

    message:
      descriptor.message,
  })
    ? "FIRELINE_APPROACH"
    : "GENERAL_ALERT";
}

export function createDeliveredAlertTrace(
  descriptor:
    AlertDescriptor,
  delivery:
    FieldLinkDeliveredAlert,
  attemptedAt =
    new Date()
      .toISOString(),
): AlertDeliveryTrace {
  const recipients =
    safeCount(
      delivery.recipients,
    );

  const acknowledged =
    safeCount(
      delivery.acknowledged,
    );

  const sentAt =
    delivery.sentAt ||
    attemptedAt;

  const deliveryId =
    delivery.deliveryId
      ? String(
          delivery.deliveryId,
        )
      : null;

  const deliveryStatus:
    AlertDeliveryStatus =
    acknowledged > 0
      ? "ACKNOWLEDGED"
      : deliveryId ||
          recipients > 0
        ? "DELIVERED"
        : "FAILED";

  return {
    traceId:
      [
        descriptor.sourceAlertId,
        deliveryId ??
          sentAt,
      ].join(":"),

    sourceAlertId:
      descriptor.sourceAlertId,

    classification:
      classifyAlert(
        descriptor,
      ),

    alertType:
      descriptor.alertType ??
      "UNKNOWN",

    title:
      descriptor.title ??
      "현장 경보",

    detectedAt:
      descriptor.detectedAt ??
      null,

    attemptedAt,

    sentAt,

    deliveryId,

    recipients,

    acknowledged,

    successRatePct:
      safePercent(
        delivery.successRatePct,
      ),

    deliveryStatus,

    source:
      delivery.source ||
      "FIELDLINK",

    error:
      null,
  };
}

export function createFailedAlertTrace(
  descriptor:
    AlertDescriptor,
  error:
    unknown,
  attemptedAt =
    new Date()
      .toISOString(),
): AlertDeliveryTrace {
  return {
    traceId:
      [
        descriptor.sourceAlertId,
        attemptedAt,
        "FAILED",
      ].join(":"),

    sourceAlertId:
      descriptor.sourceAlertId,

    classification:
      classifyAlert(
        descriptor,
      ),

    alertType:
      descriptor.alertType ??
      "UNKNOWN",

    title:
      descriptor.title ??
      "현장 경보",

    detectedAt:
      descriptor.detectedAt ??
      null,

    attemptedAt,

    sentAt:
      null,

    deliveryId:
      null,

    recipients:
      0,

    acknowledged:
      0,

    successRatePct:
      null,

    deliveryStatus:
      "FAILED",

    source:
      "FIELDLINK",

    error:
      error instanceof Error
        ? error.message
        : String(error),
  };
}

export function appendAlertDeliveryTrace(
  traces:
    AlertDeliveryTrace[],
  trace:
    AlertDeliveryTrace,
  limit = 30,
) {
  const rows = [
    trace,
    ...traces.filter(
      (row) =>
        row.traceId !==
        trace.traceId,
    ),
  ];

  return rows.slice(
    0,
    Math.max(
      1,
      limit,
    ),
  );
}

export function normalizeAlertDeliveryTraces(
  value: unknown,
): AlertDeliveryTrace[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .filter(
      (
        row,
      ): row is
        AlertDeliveryTrace =>
        Boolean(
          row &&
          typeof row ===
            "object" &&
          typeof (
            row as
              AlertDeliveryTrace
          ).traceId ===
            "string" &&
          typeof (
            row as
              AlertDeliveryTrace
          ).sourceAlertId ===
            "string",
        ),
    )
    .slice(0, 30);
}
