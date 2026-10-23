"use client";
import { useMemo, useRef, useState } from "react";

// Small, dependency-free charts for the Analytics page. One series each, in the brand sage,
// with a light grid, thin marks and a hover tooltip. Sizes follow the container's width.
const INK = "var(--paper)", DIM = "var(--dim)", GRID = "rgba(31,40,41,.08)", SERIES = "#5f8787";

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}
function useWidth() {
  const [w, setW] = useState(600);
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = (el: HTMLDivElement | null) => {
    if (!el || ref.current === el) return;
    ref.current = el;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
  };
  return [w, cb] as const;
}

type Point = { label: string; value: number; tip: string };

// Change over time: a 2px line over a soft area, with a crosshair and tooltip on hover.
export function AreaChart({ data, height = 220, unit }: { data: Point[]; height?: number; unit: string }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z` : "";
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = data.length < 2 ? 0 : Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }
  return (
    <div ref={ref} className="ch">
      <svg width={w} height={height} onPointerMove={move} onPointerLeave={() => setHover(null)} role="img" aria-label={`${unit} over time`}>
        <defs><linearGradient id="ch-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={SERIES} stopOpacity=".22" /><stop offset="1" stopColor={SERIES} stopOpacity="0" /></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(max * f)} y2={y(max * f)} stroke={GRID} />
            <text x={pad.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill={DIM}>{Math.round(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => i % every === 0 && <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill={DIM}>{d.label}</text>)}
        <path d={area} fill="url(#ch-fill)" />
        <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.length === 1 && <circle cx={x(0)} cy={y(data[0].value)} r="4" fill={SERIES} />}
        {hover !== null && data[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={INK} strokeOpacity=".25" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={SERIES} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div className="ch-tip" style={{ left: Math.min(Math.max(x(hover), 70), w - 70), top: y(data[hover].value) - 12 }}>
          <b>{data[hover].value.toLocaleString()} {unit}</b><span>{data[hover].tip}</span>
        </div>
      )}
    </div>
  );
}

// Magnitude by bucket (e.g. hour of day): thin bars with rounded tops on the baseline.
export function BarChart({ data, height = 200, unit, highlight }: { data: Point[]; height?: number; unit: string; highlight?: number }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 8, t: 10, b: 26 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const slot = iw / Math.max(1, data.length), bw = Math.max(3, Math.min(22, slot - 2));
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 40))));
  return (
    <div ref={ref} className="ch">
      <svg width={w} height={height} role="img" aria-label={`${unit} by ${data.length} buckets`} onPointerLeave={() => setHover(null)}>
        {[0, .5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={pad.l + iw} y1={pad.t + ih - ih * f} y2={pad.t + ih - ih * f} stroke={GRID} />
            <text x={pad.l - 8} y={pad.t + ih - ih * f + 4} textAnchor="end" fontSize="11" fill={DIM}>{Math.round(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * ih, cx = pad.l + slot * i + slot / 2;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
              {h > 0 && <path d={`M${cx - bw / 2},${pad.t + ih}V${pad.t + ih - h + r}Q${cx - bw / 2},${pad.t + ih - h} ${cx - bw / 2 + r},${pad.t + ih - h}H${cx + bw / 2 - r}Q${cx + bw / 2},${pad.t + ih - h} ${cx + bw / 2},${pad.t + ih - h + r}V${pad.t + ih}Z`}
                fill={SERIES} opacity={hover === null ? (highlight === undefined || highlight === i ? 1 : .55) : hover === i ? 1 : .4} />}
              {i % every === 0 && <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill={DIM}>{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="ch-tip" style={{ left: Math.min(Math.max(pad.l + slot * hover + slot / 2, 70), w - 70), top: pad.t + ih - (data[hover].value / max) * ih - 12 }}>
          <b>{data[hover].value.toLocaleString()} {unit}</b><span>{data[hover].tip}</span>
        </div>
      )}
    </div>
  );
}

// Ranked list: name, a thin bar and the value. Hover shows the detail.
export function RankList({ rows, unit, empty }: { rows: { name: string; value: number; detail?: string }[]; unit: string; empty: string }) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.value)), [rows]);
  if (!rows.length) return <p className="ch-empty">{empty}</p>;
  return (
    <ol className="rank">
      {rows.map((r, i) => (
        <li key={r.name} title={`${r.name}: ${r.value.toLocaleString()} ${unit}${r.detail ? ` · ${r.detail}` : ""}`}>
          <span className="rank-n">{i + 1}</span>
          <div className="rank-main"><div className="rank-top"><b translate="no">{r.name}</b><em>{r.value.toLocaleString()} <small>{unit}</small></em></div>
            <i><s style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} /></i>
            {r.detail && <small>{r.detail}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
