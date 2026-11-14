import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { displacementFromReference, NetworkDataSummary, PositionDataPanel, validDeviceSample } from "./DeviceDataPanels";
import { AirQualityDataPanel, WildfireRiskDataPanel } from "./EnvironmentDataPanels";
import type { TelemetrySample } from "./operationalEvidence";
const sample: TelemetrySample = { assetId: "device-1", observedAt: new Date().toISOString(), receivedAt: new Date().toISOString(), latitude: 36.37, longitude: 127.33, sequence: 1 };
it("기준점을 자동 생성하지 않고 같은 장비의 직선 이동량만 계산한다", () => {
  expect(displacementFromReference(null, sample)).toBeNull();
  const reference = { assetId: sample.assetId, latitude: sample.latitude!, longitude: sample.longitude! };
  expect(displacementFromReference(reference, sample)).toBe(0);
  const moved = displacementFromReference(reference, { ...sample, latitude: sample.latitude! + 0.001 });
  expect(moved).toBeGreaterThan(110); expect(moved).toBeLessThan(112);
  expect(displacementFromReference(reference, { ...sample, assetId: "other" })).toBeNull();
  expect(validDeviceSample({ ...sample, receivedAt: "", latitude: NaN })).toBe(false);
});
it("장비 미수신·미시험을 성공/실패나 0값으로 꾸미지 않는다", () => {
  const position = renderToStaticMarkup(createElement(PositionDataPanel, { locations: [], samples: [] }));
  expect(position).toContain("장비 수신 대기"); expect(position).toContain("기준점 미설정");
  expect(position).not.toContain("0m/s");
  const network = renderToStaticMarkup(createElement(NetworkDataSummary, { locations: [], samples: [] }));
  expect(network).toContain("미시험을 실패로 표시하지 않습니다"); expect(network).not.toContain("100%");
});
it("공공데이터는 수치 카드만 표시하며 LED 모양이나 전광판 문구를 만들지 않는다", () => {
  const html = renderToStaticMarkup(createElement(AirQualityDataPanel, { latitude: 36.37, longitude: 127.33 })) + renderToStaticMarkup(createElement(WildfireRiskDataPanel));
  expect(html).toContain("PM10"); expect(html).toContain("PM2.5"); expect(html).toContain("산림청");
  expect(html).not.toContain("kma-led"); expect(html).not.toContain("전광판");
});
