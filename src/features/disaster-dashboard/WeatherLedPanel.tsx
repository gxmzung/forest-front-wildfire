import { useEffect, useRef, useState } from "react";
import type { WeatherObservation } from "./weatherObservation";
import { createWeatherDelivery, ledRequest, weatherLedBitmap, weatherLedText, type LedDevice, type LedReceipt } from "./weatherLed";

export default function WeatherLedPanel({ observation, fresh, eventId }: { observation: WeatherObservation | null; fresh: boolean; eventId: string }) {
  const [device, setDevice] = useState<LedDevice | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [automatic, setAutomatic] = useState(true);
  const [message, setMessage] = useState("장치를 인식하면 최신 기상정보를 자동으로 송신합니다.");
  const [failure, setFailure] = useState("");
  const delivery = useRef<ReturnType<typeof createWeatherDelivery> | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const text = observation ? weatherLedText(observation) : "기상정보 조회 후 표시됩니다.";
  const key = `${eventId}:${observation?.observedAt}:${text}`;

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    delivery.current = createWeatherDelivery(async (_key, line) => {
      setSending(true);
      setFailure("");
      setMessage("최신 기상정보를 전광판으로 송신 중…");
      const bitmap = await weatherLedBitmap(line);
      controller.signal.throwIfAborted();
      const receipt = await ledRequest<LedReceipt>("scroll", bitmap, controller.signal);
      if (!receipt.acked) throw new Error("전광판의 송신 확인을 받지 못했습니다.");
      if (!controller.signal.aborted) {
        setSending(false);
        setMessage(`${new Date().toLocaleTimeString("ko-KR")} ${receipt.skipped ? "동일 문구 유지" : "송신 완료"} · 왼쪽 이동 재생 중`);
      }
    }, error => {
      setSending(false);
      setDevice(null);
      setFailure(error instanceof Error ? error.message : "전광판 송신에 실패했습니다.");
    });
    return () => { controller.abort(); delivery.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (device && automatic && observation && fresh) delivery.current?.enqueue(key, text);
    else delivery.current?.clear();
  }, [device, automatic, !!observation, fresh, key, text]);

  async function recognize() {
    setRecognizing(true);
    setFailure("");
    try {
      const found = await ledRequest<LedDevice>("discover", {}, lifetime.current?.signal);
      if (!found.connected || found.width !== 256 || found.height !== 32) throw new Error("4장 전광판의 장치 정보를 확인하지 못했습니다.");
      if (lifetime.current?.signal.aborted) return;
      delivery.current?.reset();
      setDevice(found);
      setMessage("장치 인식 완료 · 새 기상정보 송신 대기");
    } catch (error) {
      if (lifetime.current?.signal.aborted) return;
      setDevice(null);
      setFailure(error instanceof Error ? error.message : "장치를 인식하지 못했습니다.");
    } finally { if (!lifetime.current?.signal.aborted) setRecognizing(false); }
  }

  return <section className="weather-led-panel" aria-label="기상정보 전광판">
    <strong>기상정보 전광판</strong>
    <p>가로 4장 · 256×32 · 나눔스퀘어 · 왼쪽 이동</p>
    <div className="weather-led-preview" title={text}>{text}</div>
    <button type="button" onClick={() => void recognize()} disabled={recognizing || sending}>{recognizing ? "인식 중…" : "전광판 장치 인식"}</button>
    <label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />기상정보 갱신 시 자동 송신</label>
    <button type="button" disabled={!device || !observation || !fresh || sending || recognizing} onClick={() => { delivery.current?.reset(); delivery.current?.enqueue(key, text); }}>전광판으로 보내기</button>
    {device && <p>{device.model} · {device.firmware}</p>}
    <p role="status" aria-live="polite" className={failure ? "weather-led-error" : ""}>{failure || message}</p>
    {!fresh && <p>최신 기상정보를 조회하면 자동 송신을 이어갑니다.</p>}
    <a href="/wf4-bridge.zip" download>전광판 연결 도구 다운로드</a>
    <small>이 서비스 화면을 열어 두면 다른 탭을 보는 동안에도 갱신합니다. 연결 도구와 인터넷·WF4 연결이 필요합니다.</small>
  </section>;
}
