import type { LogoLayout } from "@/lib/types";

// The venue logo inside its rounded frame, zoomed and moved the way the owner set it in Settings.
export function logoFit(l: LogoLayout | null | undefined): LogoLayout {
  return l && typeof l.zoom === "number" ? l : { zoom: 1, x: 0, y: 0 };
}

export default function LogoMark({ src, layout, className, alt = "", style }: { src: string; layout?: LogoLayout | null; className: string; alt?: string; style?: React.CSSProperties }) {
  const l = logoFit(layout);
  return (
    <span className={className} style={style}>
      <img src={src} alt={alt} draggable={false} style={{ transform: `translate(${l.x}%, ${l.y}%) scale(${l.zoom})` }} />
    </span>
  );
}
