import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_RETRIES,
  playbackStateLabel,
  retryDelayMs,
  stateAfterFatalError,
} from "./videoPlaybackState";

describe("video playback resilience", () => {
  it("uses capped exponential retry delay", () => {
    expect(retryDelayMs(1)).toBe(1000);
    expect(retryDelayMs(2)).toBe(2000);
    expect(retryDelayMs(3)).toBe(4000);
    expect(retryDelayMs(4)).toBe(8000);
    expect(retryDelayMs(5)).toBe(8000);
    expect(retryDelayMs(10)).toBe(8000);
  });

  it("moves fatal playback failures into reconnecting before retry limit", () => {
    expect(stateAfterFatalError(0)).toEqual({
      state: "RECONNECTING",
      retry: true,
      nextAttempt: 1,
      delayMs: 1000,
    });

    expect(stateAfterFatalError(3)).toEqual({
      state: "RECONNECTING",
      retry: true,
      nextAttempt: 4,
      delayMs: 8000,
    });
  });

  it("moves playback offline after retry limit", () => {
    expect(stateAfterFatalError(MAX_VIDEO_RETRIES)).toEqual({
      state: "OFFLINE",
      retry: false,
      nextAttempt: MAX_VIDEO_RETRIES + 1,
      delayMs: 0,
    });
  });

  it("exposes operator-facing state labels", () => {
    expect(playbackStateLabel("CONNECTING")).toBe("CONNECTING");
    expect(playbackStateLabel("LIVE")).toBe("LIVE");
    expect(playbackStateLabel("RECONNECTING")).toBe("RECONNECTING");
    expect(playbackStateLabel("OFFLINE")).toBe("OFFLINE");
  });
});
