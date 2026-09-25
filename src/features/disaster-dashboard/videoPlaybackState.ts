export type VideoPlaybackState =
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "OFFLINE";

export const MAX_VIDEO_RETRIES = 5;

export function retryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, attempt);

  return Math.min(1000 * 2 ** (safeAttempt - 1), 8000);
}

export function stateAfterFatalError(
  previousAttempts: number,
): {
  state: VideoPlaybackState;
  retry: boolean;
  nextAttempt: number;
  delayMs: number;
} {
  const nextAttempt = previousAttempts + 1;

  if (nextAttempt > MAX_VIDEO_RETRIES) {
    return {
      state: "OFFLINE",
      retry: false,
      nextAttempt,
      delayMs: 0,
    };
  }

  return {
    state: "RECONNECTING",
    retry: true,
    nextAttempt,
    delayMs: retryDelayMs(nextAttempt),
  };
}

export function playbackStateLabel(state: VideoPlaybackState): string {
  switch (state) {
    case "LIVE":
      return "LIVE";
    case "RECONNECTING":
      return "RECONNECTING";
    case "OFFLINE":
      return "OFFLINE";
    default:
      return "CONNECTING";
  }
}
