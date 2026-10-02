import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  acknowledgeFieldLinkAlert,
  getFieldLinkChatMessages,
  sendFieldLinkChatMessage,
} from "./fieldlink-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FieldLink LAN chat API", () => {
  it("loads room messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (
        input: RequestInfo | URL,
      ) => {
        expect(String(input)).toContain(
          "/api/v1/chat/messages?roomId=event-test",
        );

        return new Response(
          JSON.stringify({
            messages: [],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }),
    );

    const result =
      await getFieldLinkChatMessages(
        "http://127.0.0.1:18080",
        "1234",
        "event-test",
      );

    expect(result.messages).toEqual([]);
  });

  it("sends message with PIN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (
        _input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const headers =
          new Headers(init?.headers);

        expect(
          headers.get(
            "X-FieldLink-PIN",
          ),
        ).toBe("1234");

        return new Response(
          JSON.stringify({
            messageId: "M1",
            roomId: "event-test",
            senderId: "C1",
            senderName: "GCS",
            text: "hello",
            sentAt:
              "2026-10-01T05:00:00.000Z",
            clientMessageId: "CM1",
          }),
          {
            status: 201,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );
      }),
    );

    const result =
      await sendFieldLinkChatMessage(
        "http://127.0.0.1:18080",
        "1234",
        {
          roomId: "event-test",
          senderId: "C1",
          senderName: "GCS",
          text: "hello",
          clientMessageId: "CM1",
        },
      );

    expect(result.messageId).toBe("M1");
  });

  it("ACKs FieldLink alert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (
        input: RequestInfo | URL,
      ) => {
        expect(String(input)).toContain(
          "/api/v1/alerts/D1/ack",
        );

        return new Response(
          JSON.stringify({
            deliveryId: "D1",
            sourceAlertId: "A1",
            severity: "CRITICAL",
            title: "경보",
            message: "경보",
            source: "INTEGRATED_COMMAND",
            sentAt:
              "2026-10-01T05:00:00.000Z",
            recipients: 1,
            acknowledged: 1,
            successRatePct: 100,
            acknowledgedClientIds: [
              "C1",
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );
      }),
    );

    const result =
      await acknowledgeFieldLinkAlert(
        "http://127.0.0.1:18080",
        "1234",
        "D1",
        {
          clientId: "C1",
          displayName: "GCS",
        },
      );

    expect(result.acknowledged).toBe(1);
    expect(result.successRatePct).toBe(100);
  });
});
