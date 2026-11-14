import { describe, expect, it } from "vitest";
import { pickSlenoRtkFocusCenter } from "./slenoMapFocus";

describe("pickSlenoRtkFocusCenter", () => {
  it("실제 Sleno RTK_TERMINAL의 최신 좌표를 지도 중심으로 선택한다", () => {
    const result = pickSlenoRtkFocusCenter([
      {
        category: "UAV",
        sourceSystem: "demo",
        longitude: 126.616667,
        latitude: 36.666667,
        observedAt: "2026-10-02T15:57:00+09:00",
      },
      {
        category: "RTK_TERMINAL",
        sourceSystem: "sleno-server",
        longitude: 126.88739393,
        latitude: 37.42381743,
        observedAt: "2026-10-02T15:56:24.940+09:00",
      },
      {
        category: "RTK_TERMINAL",
        sourceSystem: "sleno-server",
        longitude: 126.88739542,
        latitude: 37.42381693,
        observedAt: "2026-10-02T15:56:59.964+09:00",
      },
    ]);

    expect(result).toEqual([
      126.88739542,
      37.42381693,
    ]);
  });

  it("유효한 Sleno RTK가 없으면 null을 반환한다", () => {
    expect(
      pickSlenoRtkFocusCenter([
        {
          category: "RTK_TERMINAL",
          sourceSystem: "sleno-server",
          longitude: 0,
          latitude: 0,
          observedAt: "2026-10-02T15:56:00+09:00",
        },
      ]),
    ).toBeNull();
  });
});
