"use client";
import "@/styles/hero-mockup.css";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

const ROWS: [string, string, string, string, boolean?][] = [
  ["salad", "Goat cheese salad", "Starters", "$16"],
  ["bread", "Sourdough & dips", "Starters", "$12"],
  ["salmon", "Grilled salmon", "Mains", "$29"],
  ["fries", "Crinkle fries", "Sold out", "$9", true],
  ["espresso", "Espresso", "Coffee", "$4"],
];
const Leaf = ({ c }: { c: string }) => <svg className={`leaf ${c}`} viewBox="0 0 60 30"><path d="M2 15C14 0 44 0 58 15 44 30 14 30 2 15z" /><path d="M4 15h50" className="vein" /></svg>;

// The landing page's hero visual: the owner dashboard on a tablet, a dish on a guest's phone, and a QR code.
export default function HeroMockup() {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL("https://www.mnu.digital", { margin: 0, width: 152, color: { dark: "#1a2526", light: "#ffffff" } }).then(setQr).catch(() => {}); }, []);
  return (
    <div className="hm" aria-hidden="true">
      <div className="halo" />
      <div className="tab"><div className="tab-screen">
        <div className="tab-side"><img src="/assets/mnu-logo.png" alt="" /><span className="on">Menu</span><span>Categories</span><span>Photos</span><span>Translations</span><span>QR codes</span><span>Settings</span></div>
        <div className="tab-main">
          <div className="tab-top"><b>Dinner menu</b><i>+ Add dish</i></div>
          <div className="tab-kpis"><div><small>Menu views today</small><strong>1,284</strong><em>+12%</em></div><div><small>Dishes live</small><strong>42</strong></div><div><small>Languages</small><strong>3</strong></div></div>
          <div className="tab-rows">{ROWS.map(([img, n, sub, p, off]) => (
            <div className={`tab-row${off ? " off" : ""}`} key={n}><img src={`/assets/food/${img}-sq.jpg`} alt="" /><div><b>{n}</b><small>{sub}</small></div><em>{p}</em><s /></div>
          ))}</div>
        </div>
      </div></div>
      <Leaf c="l1" /><Leaf c="l2" /><Leaf c="l3" />
      <div className="qr-badge">{qr && <img src={qr} alt="" />}SCAN ME</div>
      <div className="phone"><div className="screen">
        <div className="ph-photo"><img src="/assets/food/salad-sq.jpg" alt="" /></div>
        <div className="ph-body">
          <b>Goat cheese salad</b>
          <p>Frisée, walnuts, crumbled goat cheese, balsamic</p>
          <div className="ph-lbl">Allergens</div>
          <div className="ph-dots"><i>D</i><i>N</i><i>V</i></div>
          <div className="ph-btn">Add to order · $16</div>
        </div>
      </div></div>
    </div>
  );
}
