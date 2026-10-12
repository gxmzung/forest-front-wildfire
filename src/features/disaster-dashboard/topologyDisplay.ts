import type { NetworkTopology } from "../../http-api";

const demoTopologyLabels: Record<string, string[]> = {
  ENDPOINT: ["대원 RTK 단말", "드론·영상장비", "400㎒ 무전기"],
  FIELD: ["LPWA · 저속", "이음5G · 고속", "무전 중계망"],
  COMMAND: ["게이트웨이·L3 스위치", "RTK 기준국", "현장 상황판"],
  BACKHAUL: ["LTE", "TVWS", "LEO 위성"],
  CLOUD: ["수집 API", "PostgreSQL", "통합 상황판"],
};

export function topologyLabelsFor(
  topology: NetworkTopology | null | undefined,
  layer: string,
  demoMode: boolean,
) {
  const labels = topology?.nodes
    .filter((node) => String(node.topologyLayer) === layer && String(node.status) !== "UNAVAILABLE")
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
    .map((node) => String(node.nodeName ?? node.nodeCode ?? ""))
    .filter(Boolean) ?? [];

  if (labels.length > 0) return labels;
  return demoMode ? demoTopologyLabels[layer] ?? [] : ["데이터 없음"];
}

export function topologyDataStatus(
  topology: NetworkTopology | null | undefined,
  demoMode: boolean,
) {
  if (topology?.nodes.length) {
    return `${topology.nodes.length}개 노드 · ${topology.links.length}개 연결`;
  }

  return demoMode ? "DEMO 운용 구성" : "API 토폴로지 데이터 없음";
}
