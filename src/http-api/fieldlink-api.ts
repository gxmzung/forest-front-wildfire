export type FieldLinkAlertSummary = {
  alerts: number;
  delivered: number;
  acknowledged: number;
  successRatePct: number | null;
};

export type FieldLinkDeliveredAlert = {
  deliveryId: string;
  sourceAlertId: string;
  severity: string;
  title: string;
  message: string;
  location?: string;
  source: string;
  sentAt: string;
  recipients: number;
  acknowledged: number;
  successRatePct: number | null;
};

export type FieldLinkAlertPayload = {
  sourceAlertId: string;
  severity: "INFO" | "WATCH" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  location?: string;
  source?: string;
};

async function fieldLinkRequest<T>(
  baseUrl: string,
  pin: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        "X-FieldLink-PIN": pin,
        ...(init.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const reason =
      payload &&
      typeof payload === "object" &&
      "error" in payload
        ? String(payload.error)
        : `HTTP_${response.status}`;

    throw new Error(reason);
  }

  return payload as T;
}

export function getFieldLinkAlertSummary(
  baseUrl: string,
  pin: string,
) {
  return fieldLinkRequest<FieldLinkAlertSummary>(
    baseUrl,
    pin,
    "/api/v1/alerts/summary",
  );
}

export function deliverFieldLinkAlert(
  baseUrl: string,
  pin: string,
  payload: FieldLinkAlertPayload,
) {
  return fieldLinkRequest<FieldLinkDeliveredAlert>(
    baseUrl,
    pin,
    "/api/v1/alerts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
