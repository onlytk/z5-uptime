const MINUTE = 60_000;

export const percent = (ok: number, total: number) => `${((ok / total) * 100).toFixed(ok === total ? 0 : 2)}%`;

export const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatTime = (iso: string) =>
  `${new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

export function timeAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / MINUTE));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

export function duration(start: string, end: string | null, now: number) {
  const minutes = Math.max(1, Math.round(((end ? Date.parse(end) : now) - Date.parse(start)) / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return `${Math.floor(minutes / 1440)} d ${Math.round((minutes % 1440) / 60)} h`;
}

/** "0.25s", "45s", "2m 05s", "10m", "1h 04m". */
export function seconds(total: number) {
  if (total < 10 && total % 1) return `${Number(total.toFixed(2))}s`;
  const s = Math.round(total);
  if (s < 60) return `${s}s`;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${pad(s % 60)}s` : `${s / 60}m`;
  const minutes = Math.floor((s % 3600) / 60);
  return minutes ? `${Math.floor(s / 3600)}h ${pad(minutes)}m` : `${Math.floor(s / 3600)}h`;
}
