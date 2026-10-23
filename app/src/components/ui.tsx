import type { ReactNode } from "react";
import { LEVEL_LABEL, type Level } from "../lib/history";

export const LEVEL_DOT: Record<Level, string> = { up: "bg-good", degraded: "bg-warn", down: "bg-bad", unknown: "bg-white/25" };
const VALUE_COLOR: Record<Level, string> = { up: "", degraded: "text-warn", down: "text-bad", unknown: "" };
export const LEVEL_TEXT: Record<Level, string> = { up: "text-muted", degraded: "text-warn", down: "text-bad", unknown: "text-dim" };

export function Card({ children }: { children: ReactNode }) {
  return <div className="card-sheen overflow-hidden rounded-2xl border border-line bg-panel">{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="heading mb-4 text-xl sm:text-2xl">{children}</h2>;
}

export function Dot({ level, className = "h-2 w-2" }: { level: Level; className?: string }) {
  return <span className={`shrink-0 rounded-full ${LEVEL_DOT[level]} ${className}`} />;
}

export function StatusLabel({ level }: { level: Level }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 text-[13px] ${LEVEL_TEXT[level]}`}>
      <Dot level={level} />
      {LEVEL_LABEL[level]}
    </span>
  );
}

export interface StatProps {
  label: string;
  value: string;
  hint: string;
  level?: Level;
}

export function Stat({ label, value, hint, level = "up" }: StatProps) {
  return (
    <div className="card-sheen rounded-2xl border border-line bg-panel/80 px-4 py-3.5 backdrop-blur sm:px-5 sm:py-4">
      <p className="text-xs text-dim">{label}</p>
      <p className={`heading mt-1.5 text-2xl tabular-nums sm:text-[28px] ${VALUE_COLOR[level]}`}>{value}</p>
      <p className="mt-0.5 min-h-4 text-xs text-dim">{hint}</p>
    </div>
  );
}
