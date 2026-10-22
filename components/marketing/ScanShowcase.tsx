"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const DISHES = [
  ["bread", "Sourdough & dips", "Tahini, tomato salsa", "$12"],
  ["salad", "Goat cheese salad", "Frisée, walnuts", "$16"],
  ["salmon", "Grilled salmon", "Lemon, dill", "$29"],
  ["espresso", "Espresso", "Double shot", "$4"],
];

// Dark-panel illustration: a table card with a QR code being scanned, and the menu it opens on a phone.
export default function ScanShowcase() {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/`, { margin: 0, width: 240, color: { dark: "#1f2829", light: "#ffffff" } }).then(setQr);
  }, []);

  return (
    <div className="scan-show" aria-hidden="true">
      <div className="ss-tent">
        <div className="ss-qr">{qr && <img src={qr} alt="" />}<i className="ss-beam" /></div>
        <small>SCAN TO ORDER</small>
        <b>Table 7</b>
      </div>
      <svg className="ss-path" viewBox="0 0 120 60"><path d="M4 50 C 40 50, 70 10, 116 8" /></svg>
      <div className="ss-phone"><div className="ss-screen">
        <div className="ss-hd"><small>RESTAURANT · BAR</small><b>Olive &amp; Salt</b><span>Table 7</span></div>
        <div className="ss-chips"><span className="on">Starters</span><span>Mains</span><span>Coffee</span></div>
        {DISHES.map(([img, n, d, p]) => (
          <div className="ss-it" key={n}><img src={`/assets/food/${img}-sq.jpg`} alt="" /><div><b>{n}</b><span>{d}</span></div><em>{p}</em><i>+</i></div>
        ))}
        <div className="ss-bar"><span>2 items</span><b>View order · $28</b></div>
      </div></div>
      <div className="ss-toast"><i>✓</i><div><b>Order #1048 sent</b><span>The kitchen has it</span></div></div>
    </div>
  );
}
