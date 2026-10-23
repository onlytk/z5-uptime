import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";

export interface ChartPoint {
  at: number;
  value: number | null;
  /** Extra line in the tooltip. */
  detail?: string;
}

const HEIGHT = 150;
const PAD = { top: 10, right: 8, bottom: 22, left: 52 };
const HOUR = 3_600_000;

const dayLabel = (at: number) => new Date(at).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const hourLabel = (at: number) =>
  `${new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const TOOLTIP_W = 168;

/** Rounds the top of the axis up to 1, 2 or 5 times a power of ten. */
export function decimalMax(max: number) {
  const step = 10 ** Math.floor(Math.log10(max || 1));
  return ([1, 2, 5, 10].find((m) => m * step >= max) ?? 10) * step;
}

/** Rounds a duration in seconds up to one that reads well halved: 10s, 1m, 10m, 1h. */
export function durationMax(max: number) {
  return [2, 4, 10, 20, 30, 60, 120, 240, 600, 1200, 1800, 3600, 7200].find((s) => s >= max) ?? Math.ceil(max / 3600) * 3600;
}

/** Hourly values as a line from zero up, with a crosshair and tooltip. Gaps in the data stay gaps. */
export default function LineChart({
  title,
  points,
  format,
  from,
  to,
  roundMax = decimalMax,
}: {
  title: string;
  points: ChartPoint[];
  format: (v: number) => string;
  from: number;
  to: number;
  roundMax?: (max: number) => number;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const values = points.flatMap((p) => (p.value == null ? [] : [p.value]));
  const top = roundMax(Math.max(...values, 0) * 1.1);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (at: number) => PAD.left + ((at - from) / (to - from)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const segments: ChartPoint[][] = [];
  points.forEach((p, i) => {
    if (p.value == null) return;
    if (i === 0 || points[i - 1].value == null || p.at - points[i - 1].at > HOUR) segments.push([]);
    segments.at(-1)!.push(p);
  });
  const path = (seg: ChartPoint[]) => seg.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.value!).toFixed(1)}`).join("");
  const days = Array.from({ length: Math.floor((to - from) / (24 * HOUR)) + 1 }, (_, i) => Math.ceil(from / (24 * HOUR)) * 24 * HOUR + i * 24 * HOUR).filter((d) => d < to);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const at = from + ((e.nativeEvent.offsetX - PAD.left) / plotW) * (to - from);
    const near = points.filter((p) => p.value != null).reduce<ChartPoint | null>((best, p) => (!best || Math.abs(p.at - at) < Math.abs(best.at - at) ? p : best), null);
    setHover(near);
  }

  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium">{title}</p>
      <div ref={ref} className="relative mt-3">
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={title} className="block">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(top * f)} y2={y(top * f)} stroke="rgb(255 255 255 / 0.06)" />
                <text x={PAD.left - 8} y={y(top * f)} dy="0.32em" textAnchor="end" className="fill-dim text-[11px] tabular-nums">
                  {format(top * f)}
                </text>
              </g>
            ))}
            {days.map((d) => (
              <text key={d} x={x(d)} y={HEIGHT - 6} textAnchor="middle" className="fill-dim text-[11px]">
                {dayLabel(d)}
              </text>
            ))}
            {segments.map((seg) => (
              <g key={seg[0].at}>
                <path d={`${path(seg)}L${x(seg.at(-1)!.at)},${y(0)}L${x(seg[0].at)},${y(0)}Z`} fill="var(--color-series)" opacity={0.08} />
                <path d={path(seg)} fill="none" stroke="var(--color-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}
            {hover && (
              <g>
                <line x1={x(hover.at)} x2={x(hover.at)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgb(255 255 255 / 0.25)" />
                <circle cx={x(hover.at)} cy={y(hover.value!)} r={4} fill="var(--color-series)" stroke="var(--color-panel)" strokeWidth={2} />
              </g>
            )}
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {hover && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-page/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
            style={{ left: x(hover.at) + 12 + TOOLTIP_W > width ? x(hover.at) - 12 - TOOLTIP_W : x(hover.at) + 12, width: TOOLTIP_W }}
          >
            <p className="font-medium tabular-nums text-white">{format(hover.value!)}</p>
            {hover.detail && <p className="tabular-nums text-muted">{hover.detail}</p>}
            <p className="mt-0.5 text-dim">{hourLabel(hover.at)}</p>
          </div>
        )}
        {!values.length && width > 0 && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-dim">No readings yet</p>}
      </div>
    </div>
  );
}
