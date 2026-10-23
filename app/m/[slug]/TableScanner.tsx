"use client";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Reads the QR code on a guest's table with the phone camera and returns its table number.
// Uses the browser's own barcode reader when there is one, otherwise jsQR (loaded on demand).
export default function TableScanner({ slug, labels, onFound, onClose }: {
  slug: string;
  labels: { title: string; help: string; cameraError: string; wrong: string; close: string };
  onFound: (tableNo: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function read(text: string) {
      try {
        const u = new URL(text, window.location.origin);
        const t = u.searchParams.get("t");
        if (u.pathname.replace(/\/$/, "") !== `/m/${slug}` || !t || !/^\d{1,3}$/.test(t)) { setErr(labels.wrong); return false; }
        stopped = true;
        onFound(t);
        return true;
      } catch { setErr(labels.wrong); return false; }
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch { setErr(labels.cameraError); return; }
      if (stopped || !video.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      let busy = false;
      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && !busy) {
          busy = true;
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes[0] && read(codes[0].rawValue)) return;
            } else if (jsQR && ctx) {
              const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480) || 480;
              canvas.width = w; canvas.height = h;
              ctx.drawImage(v, 0, 0, w, h);
              const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
              if (code && read(code.data)) return;
            }
          } catch { /* try the next frame */ }
          busy = false;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, [slug, labels, onFound]);

  return (
    <div className="g-scan" role="dialog" aria-modal="true" aria-label={labels.title}>
      <video ref={video} playsInline muted />
      <div className="g-scan-frame" aria-hidden="true"><i /></div>
      <div className="g-scan-bar">
        <b>{labels.title}</b>
        <p>{err || labels.help}</p>
        <button type="button" className="g-cta ghost" onClick={onClose}>{labels.close}</button>
      </div>
    </div>
  );
}
