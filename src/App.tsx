import UnifiedDisasterDashboard from "./features/disaster-dashboard/UnifiedDisasterDashboard";
import DeviceManagementPage from "./pages/device/DeviceManagementPage";
import LocalToolsPage, { isLocalToolsRoute } from './pages/LocalToolsPage';
import "./styles.css";
import "./features/disaster-dashboard/reference-command-center.css";
import "./features/disaster-dashboard/cinematic-exhibition.css";
import './features/disaster-dashboard/panel-readability.css';

function normalizedPath() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path || "/";
}

export default function App() {
  const path = normalizedPath();

  if (isLocalToolsRoute(path, window.location.hostname)) return <LocalToolsPage />;

  if (path === "/device") {
    return <DeviceManagementPage />;
  }

  return (
    <div className="app-shell">
      <UnifiedDisasterDashboard />
    </div>
  );
}
