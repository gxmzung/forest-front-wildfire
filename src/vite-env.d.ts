/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DASHBOARD_API_BASE_URL?: string;
  readonly VITE_TELEMETRY_WS_URL?: string;
  readonly VITE_LOCAL_E2E_ENABLED?: string;
  readonly VITE_FIELD_MODE_ENABLED?: string;
  readonly VITE_FIELD_EVENT_ID?: string;
  readonly VITE_FIELD_ASSET_CODE?: string;
  readonly VITE_DEM_TILE_URL?: string;
  readonly VITE_DEM_TILE_SIZE?: string;
  readonly VITE_DEM_ENCODING?: string;
  readonly VITE_DEM_MAX_ZOOM?: string;
  readonly VITE_DEM_ATTRIBUTION?: string;
  readonly VITE_DEM_RESOLUTION_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
