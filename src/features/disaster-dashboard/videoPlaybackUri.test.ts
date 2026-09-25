import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBrowserPlaybackUri } from "./videoPlaybackUri";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveBrowserPlaybackUri", () => {
  it("RTSP 경로를 브라우저용 HLS 주소로 변환한다", () => {
    vi.stubEnv("VITE_VIDEO_HLS_BASE_URL", "http://127.0.0.1:8888");

    expect(
      resolveBrowserPlaybackUri("rtsp://127.0.0.1:8554/md1000"),
    ).toBe("http://127.0.0.1:8888/md1000/index.m3u8");
  });

  it("이미 브라우저에서 재생 가능한 HTTP 주소는 유지한다", () => {
    const uri = "https://example.test/live/index.m3u8";

    expect(resolveBrowserPlaybackUri(uri)).toBe(uri);
  });
});
