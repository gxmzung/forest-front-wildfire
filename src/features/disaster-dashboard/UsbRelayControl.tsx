import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./usb-relay-control.css";

type RelayDevice = {
  vendorId: number;
  productId: number;
  productName: string;
  opened: boolean;
  open(): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  sendFeatureReport(reportId: number, data: Uint8Array): Promise<void>;
};

type Hid = EventTarget & {
  getDevices(): Promise<RelayDevice[]>;
  requestDevice(options: { filters: { vendorId: number; productId: number }[] }): Promise<RelayDevice[]>;
};

const filter = { vendorId: 0x16c0, productId: 0x05df };
const channels = ["소리", "빨강", "노랑", "초록"] as const;

function isRelay(device: RelayDevice) {
  return device.vendorId === filter.vendorId && device.productId === filter.productId
    && device.productName === "USBRelay4";
}

async function readState(device: RelayDevice) {
  if (!device.opened) await device.open();
  const report = await device.receiveFeatureReport(0);
  if (report.byteLength === 8) return report.getUint8(7);
  if (report.byteLength === 9 && report.getUint8(0) === 0) return report.getUint8(8);
  throw new Error("USBRelay4 상태 응답 형식이 다릅니다.");
}

export default function UsbRelayControl() {
  const hid = (navigator as Navigator & { hid?: Hid }).hid;
  const dialog = useRef<HTMLDialogElement>(null);
  const current = useRef<RelayDevice | null>(null);
  const [state, setState] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hid) return;
    const browserHid = hid;
    let revision = 0;

    async function detect() {
      const request = ++revision;
      try {
        const devices = (await browserHid.getDevices()).filter(isRelay);
        if (devices.length !== 1 || request !== revision || current.current) return;
        const [device] = devices;
        const bits = await readState(device);
        if (request !== revision || current.current) return;
        current.current = device;
        setState(bits);
        setError("");
      } catch {
        if (request === revision && !current.current) setError("릴레이 상태를 읽지 못했습니다.");
      }
    }

    function disconnect(event: Event) {
      const { device } = event as Event & { device: RelayDevice };
      if (!isRelay(device)) return;
      ++revision;
      if (device === current.current) {
        current.current = null;
        setState(null);
        setError("");
      }
      void detect();
    }

    hid.addEventListener("connect", detect);
    hid.addEventListener("disconnect", disconnect);
    void detect();
    return () => {
      ++revision;
      hid.removeEventListener("connect", detect);
      hid.removeEventListener("disconnect", disconnect);
    };
  }, [hid]);

  async function connect() {
    if (!hid || busy) return;
    setBusy(true);
    setError("");
    try {
      const [device] = await hid.requestDevice({ filters: [filter] });
      if (!device) return;
      if (!isRelay(device)) throw new Error("USBRelay4 장치를 선택해 주세요.");
      current.current = device;
      const bits = await readState(device);
      if (device === current.current) setState(bits);
    } catch (reason) {
      current.current = null;
      setState(null);
      setError(reason instanceof Error ? reason.message : "릴레이를 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(channel: number) {
    const device = current.current;
    if (!device || state === null || busy) return;
    const mask = 1 << (channel - 1);
    const enable = (state & mask) === 0;
    setBusy(true);
    setError("");
    try {
      await device.sendFeatureReport(0, new Uint8Array([enable ? 0xff : 0xfd, channel, 0, 0, 0, 0, 0, 0]));
      const bits = await readState(device);
      if (device !== current.current) return;
      setState(bits);
      if (Boolean(bits & mask) !== enable) setError(`${channel}번 채널 상태가 바뀌지 않았습니다.`);
    } catch {
      if (device === current.current) {
        current.current = null;
        setState(null);
        setError("릴레이 응답을 확인하지 못했습니다. 장치를 다시 연결해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>USB 릴레이</button>
      {createPortal(<dialog ref={dialog} className="usb-relay-dialog" aria-labelledby="usb-relay-title">
        <header>
          <h2 id="usb-relay-title">USB 릴레이</h2>
          <form method="dialog"><button type="submit">닫기</button></form>
        </header>
        <p role="status">
          {state !== null ? "USBRelay4 연결됨" : hid ? "연결된 USBRelay4 없음" : "Chrome 또는 Edge의 HTTPS 화면에서 연결할 수 있습니다."}
        </p>
        {hid && state === null && <button type="button" disabled={busy} onClick={() => void connect()}>장치 연결</button>}
        {error && <p role="alert">{error}</p>}
        <ul>
          {channels.map((label, index) => {
            const enabled = state !== null && Boolean(state & (1 << index));
            return (
              <li key={label}>
                <span>{index + 1}번 {label}</span>
                <button type="button" aria-label={`${index + 1}번 ${label}`} aria-pressed={state === null ? undefined : enabled}
                  disabled={state === null || busy} onClick={() => void toggle(index + 1)}>
                  {state === null ? "연결 필요" : enabled ? "켜짐" : "꺼짐"}
                </button>
              </li>
            );
          })}
        </ul>
      </dialog>, document.body)}
    </>
  );
}
