import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveBrowserPlaybackUri } from "./videoPlaybackUri";

type VideoPlaybackProps = {
  streamUri?: string | null;
  enabled?: boolean;
  verificationStatus?: string | null;
  label?: string;
  className?: string;
};

type PlaybackKind = "HLS" | "NATIVE" | "EMPTY";

function classifyPlayback(uri: string): PlaybackKind {
  const normalized = uri.trim().toLowerCase();

  if (!normalized) return "EMPTY";
  if (normalized.includes(".m3u8")) return "HLS";

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("blob:")
  ) {
    return "NATIVE";
  }

  return "EMPTY";
}

export default function VideoPlayback({
  streamUri,
  enabled = false,
  verificationStatus,
  label = "영상",
  className = "",
}: VideoPlaybackProps) {
  const sourceUri = streamUri?.trim() ?? "";

  const playbackUri = useMemo(
    () => resolveBrowserPlaybackUri(sourceUri),
    [sourceUri],
  );

  const kind = useMemo(
    () => classifyPlayback(playbackUri),
    [playbackUri],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [playbackError, setPlaybackError] = useState(false);
  const [playing, setPlaying] = useState(false);

  const verified = verificationStatus === "REACHABLE";

  useEffect(() => {
    setPlaybackError(false);
    setPlaying(false);
  }, [playbackUri]);

  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      !enabled ||
      !playbackUri ||
      kind !== "HLS"
    ) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUri;

      void video.play().catch(() => {
        // autoplay can be blocked by browser policy.
      });

      return () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setPlaybackError(true);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });

    hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(playbackUri);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setPlaybackError(false);

      void video.play().catch(() => {
        // muted video is normally autoplayable; controls remain available.
      });
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return;
      }

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }

      setPlaybackError(true);
      hls.destroy();
    });

    return () => {
      hls.destroy();
    };
  }, [enabled, kind, playbackUri]);

  if (!enabled || !sourceUri) {
    return (
      <div className={`video-playback video-playback--waiting ${className}`}>
        <strong>WAIT</strong>
        <span>{label} · 영상 소스 연결 대기</span>
      </div>
    );
  }

  if (!playbackUri) {
    return (
      <div className={`video-playback video-playback--waiting ${className}`}>
        <strong>WAIT</strong>
        <span>{label} · 브라우저 재생 주소 확인 필요</span>
      </div>
    );
  }

  if (kind === "HLS") {
    return (
      <div className={`video-playback video-playback--native ${className}`}>
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          controls
          onPlaying={() => {
            setPlaying(true);
            setPlaybackError(false);
          }}
          onWaiting={() => setPlaying(false)}
          onCanPlay={() => setPlaybackError(false)}
          onError={() => setPlaybackError(true)}
        />

        {!playing && !playbackError && (
          <div className="video-playback__status">
            <strong>{verified ? "VIDEO READY" : "VIDEO"}</strong>
            <span>{label} · HLS 스트림 연결 중</span>
          </div>
        )}

        {playbackError && (
          <div className="video-playback__error">
            <strong>PLAYBACK ERROR</strong>
            <span>{label} · HLS 브라우저 재생 실패</span>
          </div>
        )}
      </div>
    );
  }

  if (kind === "NATIVE") {
    return (
      <div className={`video-playback video-playback--native ${className}`}>
        <video
          src={playbackUri}
          muted
          autoPlay
          playsInline
          controls
          onPlaying={() => setPlaying(true)}
          onWaiting={() => setPlaying(false)}
          onCanPlay={() => setPlaybackError(false)}
          onError={() => setPlaybackError(true)}
        />

        {playbackError && (
          <div className="video-playback__error">
            <strong>PLAYBACK ERROR</strong>
            <span>{label} · 브라우저 재생 실패</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`video-playback video-playback--waiting ${className}`}>
      <strong>WAIT</strong>
      <span>{label} · 지원 가능한 재생 주소 대기</span>
    </div>
  );
}
