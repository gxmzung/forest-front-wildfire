import {
  describe,
  expect,
  it,
} from "vitest";

import {
  appendAlertDeliveryTrace,
  createDeliveredAlertTrace,
  createFailedAlertTrace,
  isFirelineApproachAlert,
} from "./alertDeliveryTrace";

describe(
  "ALERT-03 FieldLink delivery trace",
  () => {
    it(
      "화선 접근 경보를 식별한다",
      () => {
        expect(
          isFirelineApproachAlert({
            alertType:
              "FIRELINE_APPROACH",

            title:
              "화선 접근 경보",

            message:
              "대원이 화선에 접근 중입니다.",
          }),
        ).toBe(true);
      },
    );

    it(
      "일반 네트워크 경보를 화선 접근으로 오인하지 않는다",
      () => {
        expect(
          isFirelineApproachAlert({
            alertType:
              "NETWORK_DELAY",

            title:
              "네트워크 지연",

            message:
              "통신 지연이 발생했습니다.",
          }),
        ).toBe(false);
      },
    );

    it(
      "FieldLink 전달 결과를 delivery trace로 보존한다",
      () => {
        const trace =
          createDeliveredAlertTrace(
            {
              sourceAlertId:
                "ALERT-001",

              alertType:
                "FIRELINE_APPROACH",

              title:
                "화선 접근 경보",

              message:
                "위험 구역 접근",

              detectedAt:
                "2026-09-30T01:00:00.000Z",
            },

            {
              deliveryId:
                "DELIVERY-001",

              sourceAlertId:
                "ALERT-001",

              severity:
                "CRITICAL",

              title:
                "화선 접근 경보",

              message:
                "위험 구역 접근",

              source:
                "INTEGRATED_COMMAND",

              sentAt:
                "2026-09-30T01:00:01.000Z",

              recipients:
                3,

              acknowledged:
                0,

              successRatePct:
                100,
            },

            "2026-09-30T01:00:00.500Z",
          );

        expect(
          trace.classification,
        ).toBe(
          "FIRELINE_APPROACH",
        );

        expect(
          trace.deliveryId,
        ).toBe(
          "DELIVERY-001",
        );

        expect(
          trace.recipients,
        ).toBe(3);

        expect(
          trace.acknowledged,
        ).toBe(0);

        expect(
          trace.deliveryStatus,
        ).toBe(
          "DELIVERED",
        );
      },
    );

    it(
      "ACK가 포함된 FieldLink 응답을 확인 완료로 표시한다",
      () => {
        const trace =
          createDeliveredAlertTrace(
            {
              sourceAlertId:
                "ALERT-ACK",
            },

            {
              deliveryId:
                "DELIVERY-ACK",

              sourceAlertId:
                "ALERT-ACK",

              severity:
                "WARNING",

              title:
                "경보",

              message:
                "경보",

              source:
                "INTEGRATED_COMMAND",

              sentAt:
                "2026-09-30T01:00:01.000Z",

              recipients:
                2,

              acknowledged:
                1,

              successRatePct:
                50,
            },
          );

        expect(
          trace.deliveryStatus,
        ).toBe(
          "ACKNOWLEDGED",
        );

        expect(
          trace.acknowledged,
        ).toBe(1);

        expect(
          trace.successRatePct,
        ).toBe(50);
      },
    );

    it(
      "FieldLink 전송 실패도 같은 alert ID trace로 남긴다",
      () => {
        const trace =
          createFailedAlertTrace(
            {
              sourceAlertId:
                "ALERT-FAIL",

              title:
                "화선 접근 경보",

              message:
                "화선 접근",
            },

            new Error(
              "FIELDLINK_OFFLINE",
            ),

            "2026-09-30T01:00:00.000Z",
          );

        expect(
          trace.deliveryStatus,
        ).toBe(
          "FAILED",
        );

        expect(
          trace.sentAt,
        ).toBeNull();

        expect(
          trace.error,
        ).toBe(
          "FIELDLINK_OFFLINE",
        );
      },
    );

    it(
      "새 trace를 최신순으로 보존하고 중복 ID를 제거한다",
      () => {
        const first =
          createFailedAlertTrace(
            {
              sourceAlertId:
                "A1",
            },

            "FAIL",

            "2026-09-30T01:00:00.000Z",
          );

        const second = {
          ...first,

          traceId:
            "TRACE-2",

          sourceAlertId:
            "A2",
        };

        const rows =
          appendAlertDeliveryTrace(
            [first],
            second,
          );

        expect(
          rows.map(
            (row) =>
              row.sourceAlertId,
          ),
        ).toEqual([
          "A2",
          "A1",
        ]);
      },
    );
  },
);
