const DEFAULT_LOCAL_HLS_BASE = "http://127.0.0.1:8888";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function rtspPathname(streamUri: string): string | null {
  const value = streamUri.trim();

  if (!value.toLowerCase().startsWith("rtsp://")) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/^\/+|\/+$/g, "");

    return pathname || null;
  } catch {
    return null;
  }
}

export function resolveBrowserPlaybackUri(streamUri: string): string {
  const value = streamUri.trim();

  if (!value) {
    return "";
  }

  if (!value.toLowerCase().startsWith("rtsp://")) {
    return value;
  }

  const pathname = rtspPathname(value);

  if (!pathname) {
    return "";
  }

  const configuredBase =
    import.meta.env.VITE_VIDEO_HLS_BASE_URL?.trim() ||
    DEFAULT_LOCAL_HLS_BASE;

  const base = normalizeBaseUrl(configuredBase);

  return `${base}/${pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}/index.m3u8`;
}
