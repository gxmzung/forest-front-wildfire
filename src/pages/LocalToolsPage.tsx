import KmaWeatherEnvironmentPanel from '../features/disaster-dashboard/KmaWeatherEnvironmentPanel';
import { CommunicationTestPanel } from '../features/disaster-dashboard/CommunicationTestPanel';
import './local-tools.css';

export function isLocalToolsRoute(path: string, hostname: string) {
  return path === '/local-tools' && ['localhost', '127.0.0.1'].includes(hostname);
}

export default function LocalToolsPage() {
  return <main className="local-tools-page">
    <header className="local-tools-header"><div><h1>기상·통신 시험</h1><p>로컬 독립 실행 · 회사 사건·장비 데이터는 이 화면에서 조회하지 않습니다.</p></div><a href="/">통합상황판 열기</a></header>
    <div className="local-tools-columns"><section aria-label="독립 기상 조회"><KmaWeatherEnvironmentPanel /></section><section aria-label="독립 통신 시험"><CommunicationTestPanel /></section></div>
  </main>;
}
