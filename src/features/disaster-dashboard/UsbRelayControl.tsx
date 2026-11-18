import { useEffect, useRef, useState } from "react";
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
const channels = [[2, "빨강"], [3, "노랑"], [4, "초록"], [1, "부저"]] as const;

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

  const unsupported = "Chrome 또는 Edge의 HTTPS 화면에서 장비를 연동할 수 있습니다.";
  return (
    <div className="usb-relay-controls" role="group" aria-label="USB 릴레이 제어">
      {state === null ? (
        <button type="button" disabled={busy} title={!hid ? unsupported : undefined}
          onClick={() => hid ? void connect() : setError(unsupported)}>
          장비 연동
        </button>
      ) : channels.map(([channel, label]) => (
        <button key={channel} type="button" data-channel={channel} disabled={busy}
          aria-pressed={Boolean(state & (1 << (channel - 1)))}
          onClick={() => void toggle(channel)}>
          {label}
        </button>
      ))}
      {error && <span className="usb-relay-error" role="alert">{error}</span>}
    </div>
  );
}
