"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import ImagePacks from "./ImagePacks";

// Creates AI photos for every dish that doesn't have one, with a confirmation and live progress.
export default function BulkPhotos({ missing, onClose, onProgress }: { missing: number; onClose: () => void; onProgress: () => void }) {
  const { venue, toast } = useDash();
  const [left, setLeft] = useState<number | null>(null);
  const [state, setState] = useState<"confirm" | "running" | "done">("confirm");
  const [made, setMade] = useState(0);
  const [remaining, setRemaining] = useState(missing);
  const [msg, setMsg] = useState("");
  const [packs, setPacks] = useState(false);
  const stop = useRef(false);

  useEffect(() => {
    supabaseBrowser().rpc("image_quota", { p_venue: venue.id }).then(({ data }: { data: { used: number; quota: number; extra: number }[] | null }) => {
      const q = data?.[0];
      if (q) setLeft(Math.max(0, q.quota - q.used) + q.extra);
    });
  }, [venue.id]);

  async function run() {
    setState("running"); setMsg(""); stop.current = false;
    let total = 0;
    for (let i = 0; i < 100 && !stop.current; i++) {
      const res = await fetch("/api/ai/images-bulk", { method: "POST" }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) { setMsg(json.error ?? "Stopped: the request failed."); break; }
      total += json.done; setMade(total); setRemaining(json.remaining);
      if (json.left !== null && json.left !== undefined) setLeft(json.left);
      onProgress();
      if (json.outOfCredits) { setMsg("You’ve run out of AI images. Buy a pack to finish the rest."); break; }
      if (json.remaining === 0) break;
      if (json.done === 0) { setMsg(json.errors?.[0] ?? "Stopped: no photo could be created."); break; }
    }
    setState("done");
    if (total) toast(`${total} photo${total === 1 ? "" : "s"} added to your menu`);
  }

  const willMake = left === null ? missing : Math.min(missing, left);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && state !== "running") onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title" style={{ maxWidth: 520 }}>
        <div className="modal-head"><h3 id="bulk-title">Photos for your whole menu</h3>{state !== "running" && <button className="x" type="button" onClick={onClose} aria-label="Close">×</button>}</div>

        {state === "confirm" && (
          <>
            <p className="note">AI will create a professional photo for each of the <b>{missing}</b> dish{missing === 1 ? "" : "es"} without one, based on the dish name and description. You can replace any of them later with your own photo.</p>
            <div className="adm-facts">
              <div><small>Dishes without a photo</small><b>{missing}</b></div>
              <div><small>AI images you have left</small><b>{left ?? "…"}</b></div>
            </div>
            {left !== null && left < missing && <p className="note" style={{ color: "var(--amber)" }}>You have enough for {left}. <button type="button" className="link-btn" onClick={() => setPacks(true)}>Buy a pack</button> to cover all {missing}.</p>}
            <p className="note">These photos are marked “Illustration” on your menu, so guests know they’re not photos of the actual plate. It takes about 10 seconds per photo.</p>
            <div className="modal-foot"><span /><div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
              <button className="btn" type="button" onClick={run} disabled={left === 0}>{left === 0 ? "No images left" : `Create ${willMake} photo${willMake === 1 ? "" : "s"}`}</button>
            </div></div>
          </>
        )}

        {state !== "confirm" && (
          <>
            <div className="bulk-progress"><i style={{ width: `${missing ? Math.round((made / missing) * 100) : 100}%` }} /></div>
            <p className="note">{state === "running" ? `Creating photos… ${made} done, ${remaining} to go. Keep this window open.` : `${made} photo${made === 1 ? "" : "s"} created${remaining ? `, ${remaining} dish${remaining === 1 ? "" : "es"} still without a photo` : ""}.`}</p>
            {msg && <p className="note" style={{ color: "var(--coral)" }}>{msg} {msg.includes("pack") && <button type="button" className="link-btn" onClick={() => setPacks(true)}>Buy more images</button>}</p>}
            <div className="modal-foot"><span /><div>
              {state === "running"
                ? <button className="btn ghost" type="button" onClick={() => { stop.current = true; }}>Stop after the current photos</button>
                : <button className="btn" type="button" onClick={onClose}>Done</button>}
            </div></div>
          </>
        )}
        {packs && <ImagePacks onClose={() => setPacks(false)} />}
      </div>
    </div>
  );
}
