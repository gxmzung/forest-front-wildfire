import "./semantic-mission-poc.css";

type SemanticMissionPocPanelProps = {
  visible?: boolean;
};

const MOCK_PACKET = {
  state: "RECEIVING",
  source: "MOCK",
  observation: "FIRE DETECTED",
  confidence: 0.87,
  spreadDirection: "NE",
  packetBytes: 412,
  sourceBytes: 4_000_000,
} as const;

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(1)} kB`;
  }

  return `${bytes} B`;
}

export default function SemanticMissionPocPanel({
  visible = true,
}: SemanticMissionPocPanelProps) {
  if (!visible) return null;

  return (
    <aside
      className="semantic-mission-poc"
      aria-label="Semantic AI experimental proof of concept"
      data-state={MOCK_PACKET.state.toLowerCase()}
    >
      <header>
        <div>
          <small>MISSION BRAIN · CONCEPT VALIDATION</small>
          <strong>SEMANTIC AI</strong>
        </div>
        <span>EXPERIMENTAL</span>
      </header>

      <div className="semantic-mission-poc__warning">
        <b>PoC · MOCK DATA</b>
        <span>SEMANTIC SITUATION DATA · NOT LIVE VIDEO</span>
      </div>

      <dl>
        <div>
          <dt>State</dt>
          <dd>{MOCK_PACKET.state}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{MOCK_PACKET.source}</dd>
        </div>
        <div>
          <dt>Observation</dt>
          <dd>{MOCK_PACKET.observation}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(MOCK_PACKET.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Spread</dt>
          <dd>{MOCK_PACKET.spreadDirection}</dd>
        </div>
        <div>
          <dt>Semantic packet</dt>
          <dd>{formatBytes(MOCK_PACKET.packetBytes)}</dd>
        </div>
        <div>
          <dt>Source sample</dt>
          <dd>{formatBytes(MOCK_PACKET.sourceBytes)}</dd>
        </div>
      </dl>

      <footer>
        <span>Structured mission semantics</span>
        <small>영상 복원·실제 AI 추론 결과가 아닙니다.</small>
      </footer>
    </aside>
  );
}