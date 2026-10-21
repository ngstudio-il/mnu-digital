"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";

const QR_OPTS = { margin: 1, width: 600, color: { dark: "#1f2829", light: "#ffffff" } };

export default function QrPage() {
  const { venue, setVenue, toast } = useDash();
  const [origin, setOrigin] = useState("");
  const [main, setMain] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [count, setCount] = useState(String(venue.tables));

  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/m/${venue.slug}`;

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(link, QR_OPTS).then(setMain);
    Promise.all(Array.from({ length: venue.tables }, (_, i) => QRCode.toDataURL(`${link}?t=${i + 1}`, QR_OPTS))).then(setTables);
  }, [origin, link, venue.tables]);

  async function saveCount() {
    const n = Math.max(1, Math.min(200, parseInt(count, 10) || 1));
    setCount(String(n));
    if (n === venue.tables) return;
    const { data, error } = await supabaseBrowser().from("venues").update({ tables: n }).eq("id", venue.id).select().single();
    if (error || !data) return toast("Couldn’t save the number of tables.");
    setVenue(data);
    toast(`${n} table codes ready`);
  }

  function copy() {
    navigator.clipboard?.writeText(link).then(() => toast("Link copied"), () => toast("Select the link to copy it"));
  }

  return (
    <div className="qr-grid">
      <div className="card qr-main">
        <h3>Main menu code</h3>
        <div className="qr-frame">{main ? <img src={main} alt={`QR code for ${link}`} width={220} height={220} style={{ borderRadius: 12 }} /> : <div style={{ width: 220, height: 220 }} />}</div>
        <div className="link-box"><span>{link.replace(/^https?:\/\//, "")}</span><button className="btn sm" type="button" onClick={copy}>Copy link</button></div>
        {main && <a className="btn ghost sm" href={main} download={`${venue.slug}-menu-qr.png`}>Download PNG</a>}
        <p className="note">Scanning this code opens your menu. Guests can order for takeaway or pick their table.</p>
      </div>
      <div className="card">
        <div className="card-head">
          <h3>Table codes</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label className="field" htmlFor="tables-n" style={{ gridTemplateColumns: "auto 80px", alignItems: "center", gap: 10 }}>Tables
              <input id="tables-n" type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} onBlur={saveCount} onKeyDown={(e) => { if (e.key === "Enter") saveCount(); }} />
            </label>
            <button className="btn ghost sm" type="button" onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <p className="note">Each table gets its own code, so orders arrive with the table number attached.</p>
        <div className="tables">
          {tables.map((src, i) => (
            <a className="table-qr" key={i} href={src} download={`${venue.slug}-table-${i + 1}.png`} title={`Download table ${i + 1}`}>
              <img src={src} alt={`QR code for table ${i + 1}`} width={80} height={80} style={{ margin: "0 auto 8px", borderRadius: 8 }} />
              <b>Table {i + 1}</b>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
