import { describe, expect, it } from "vitest";
import { topologyDataStatus, topologyLabelsFor } from "./topologyDisplay";

const empty = { networks: [], nodes: [], links: [] };

describe("topology display provenance", () => {
  it("운영 API 데이터가 없을 때 기준 구성을 실제 topology처럼 만들지 않는다", () => {
    expect(topologyLabelsFor(empty, "FIELD", false)).toEqual(["데이터 없음"]);
    expect(topologyDataStatus(empty, false)).toBe("API 토폴로지 데이터 없음");
  });

  it("명시적 DEMO에서는 기존 시연용 topology 구성을 유지한다", () => {
    expect(topologyLabelsFor(empty, "FIELD", true)).toContain("LPWA · 저속");
    expect(topologyDataStatus(empty, true)).toBe("DEMO 운용 구성");
  });

  it("실제 API 노드가 있으면 운영·DEMO 모두 해당 값만 표시한다", () => {
    const topology = {
      networks: [],
      nodes: [{ nodeCode: "FIELD-1", nodeName: "실제 현장망", topologyLayer: "FIELD", status: "ACTIVE" }],
      links: [{ linkId: "link-1" }],
    };
    expect(topologyLabelsFor(topology, "FIELD", false)).toEqual(["실제 현장망"]);
    expect(topologyDataStatus(topology, false)).toBe("1개 노드 · 1개 연결");
  });
});
