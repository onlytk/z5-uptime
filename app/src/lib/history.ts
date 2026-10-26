import { isHistory } from "../../../shared/history.mjs";
import { formatDay } from "./format";

export type Level = "up" | "degraded" | "down" | "unknown";

export interface Part {
  id: string;
  name: string;
  group: string;
  note: string;
  level: Level;
  stats?: Stats;
  series?: Point[];
}

/** One hour: [hours since 1970, confirm ms under $1,000, confirm ms above, node ms]. */
export type Point = [hour: number, fastConfirmMs: number | null, confirmMs: number | null, nodeMs: number | null];

/** Timings from z5.gg, measured: latency, block and confirm times in ms, the delivery median in seconds. Missing when unknown. */
export interface Stats {
  ms?: number;
  avgMs?: number;
  blocks?: number;
  fastBlocks?: number;
  blockMs?: number;
  fastConfirmMs?: number;
  confirmMs?: number;
  deliverySeconds?: number;
}

/** Checks per UTC day ("2026-10-22"), as [total, fine]. */
export type Days = Record<string, [number, number]>;

export interface Incident {
  id: string;
  name: string;
  level: "down" | "degraded";
  start: string;
  end: string | null;
}

/** history.json, written by worker/check.js. */
export interface History {
  components: Record<string, { name: string; group: string; note: string; days: Days }>;
  incidents: Incident[];
  last: { at: string; site: "up" | "down"; code: number | null; partsKnown?: boolean; order?: string[]; components: Part[] };
}

/** Throws unless every record the page reads is present and well-formed (shared with worker/check.js). */
export function parseHistory(data: unknown): History {
  if (!isHistory(data) || !(data as History).last) throw new Error("history.json is malformed");
  return data as History;
}

export const DAYS = 90;
export const PHONE_DAYS = 30;
export const SITE_ID = "site";
export const NETWORKS_GROUP = "Payment detection";
const GROUP_ORDER = ["Reachability", "Platform", NETWORKS_GROUP, "Money movement"];
const DAY_MS = 86_400_000;
// checks run every five minutes; three missed in a row is worth saying
const STALE_MS = 15 * 60_000;

export const LEVEL_LABEL: Record<Level, string> = { up: "Working", degraded: "Some trouble", down: "Down", unknown: "Unknown" };

export function lastDays(now: number, count = DAYS) {
  return Array.from({ length: count }, (_, i) => new Date(now - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

export function tally(h: History, ids: string[], days: string[]) {
  let total = 0;
  let ok = 0;
  for (const day of days)
    for (const id of ids) {
      const counts = h.components[id]?.days[day];
      if (counts) (total += counts[0]), (ok += counts[1]);
    }
  return { total, ok };
}

/** Known trouble first, then anything unknown; only all-up is up. */
export function worst(levels: Level[]): Level {
  if (levels.includes("down")) return "down";
  if (levels.includes("degraded")) return "degraded";
  return levels.includes("unknown") || !levels.length ? "unknown" : "up";
}

const partsVisible = (h: History) => h.last.site === "up" && h.last.partsKnown !== false;

/** The parts as last read from z5.gg, or none when they couldn't be read. */
export const visibleParts = (h: History) => (partsVisible(h) ? h.last.components.filter((c) => c.id !== SITE_ID) : []);

/** A part's current level. Unknown while z5.gg is unreachable or its parts couldn't be read. */
export function levelReader(h: History) {
  const levels = new Map(h.last.components.map((c) => [c.id, c.level]));
  return (id: string): Level => (id === SITE_ID || partsVisible(h) ? (levels.get(id) ?? "unknown") : "unknown");
}

export function groupedIds(h: History) {
  const ids = [...new Set([...(h.last.order ?? []), ...Object.keys(h.components)])].filter((id) => h.components[id]);
  const extra = [...new Set(ids.map((id) => h.components[id].group))].filter((g) => !GROUP_ORDER.includes(g));
  return [...GROUP_ORDER, ...extra]
    .map((group) => ({ group, ids: ids.filter((id) => h.components[id].group === group) }))
    .filter((g) => g.ids.length);
}

export const isStale = (h: History, now: number) => now - Date.parse(h.last.at) > STALE_MS;

/** Incidents that overlap the shown window: ongoing ones always count. */
export function recentIncidents(h: History, now: number) {
  const from = now - DAYS * DAY_MS;
  return h.incidents.filter((i) => !i.end || Date.parse(i.end) >= from).sort((a, b) => b.start.localeCompare(a.start));
}

/** "90 days" once the window is full of history, otherwise "since 22 Oct 2026". */
export function historySpan(h: History, now: number) {
  const days = lastDays(now);
  const first = days.find((day) => h.components[SITE_ID]?.days[day]);
  return first && first !== days[0] ? `since ${formatDay(first)}` : `${DAYS} days`;
}

const listNames = (parts: Part[]) =>
  parts.length === 1 ? parts[0].name : parts.length <= 3 ? `${parts.slice(0, -1).map((p) => p.name).join(", ")} and ${parts.at(-1)!.name}` : `${parts.length} parts`;

/** The headline. Only an up-to-date check with every part known can say everything works. */
export function verdict(h: History, now: number): { level: Level; lead: string; tail: string } {
  if (isStale(h, now)) return { level: "unknown", lead: "Checks are", tail: "running late." };
  if (h.last.site !== "up") return { level: "down", lead: "z5.gg isn't", tail: "answering." };
  if (!partsVisible(h)) return { level: "unknown", lead: "z5.gg is up,", tail: "details unavailable." };
  const parts = h.last.components.filter((c) => c.id !== SITE_ID);
  const down = parts.filter((c) => c.level === "down");
  if (down.length) return { level: "down", lead: listNames(down), tail: down.length === 1 ? "is down." : "are down." };
  const slow = parts.filter((c) => c.level === "degraded");
  if (slow.length) return { level: "degraded", lead: listNames(slow), tail: slow.length === 1 ? "is having trouble." : "are having trouble." };
  if (parts.some((c) => c.level === "unknown")) return { level: "unknown", lead: "Some parts are", tail: "unknown right now." };
  return { level: "up", lead: "Everything is", tail: "working." };
}

/** Networks seen working out of all of them. Unknown ones are never counted as working. */
export function networkSummary(h: History): { value: string; hint: string; level: Level } {
  if (h.last.site !== "up") return { value: "—", hint: "unknown while z5.gg is down", level: "unknown" };
  if (!partsVisible(h)) return { value: "—", hint: "couldn't be read", level: "unknown" };
  const networks = h.last.components.filter((c) => c.group === NETWORKS_GROUP);
  if (!networks.length) return { value: "—", hint: "none reported", level: "unknown" };
  const working = networks.filter((c) => c.level === "up").length;
  const trouble = networks.filter((c) => c.level === "down" || c.level === "degraded");
  const unknown = networks.length - working - trouble.length;
  const level = trouble.length ? worst(trouble.map((c) => c.level)) : unknown ? "unknown" : "up";
  let hint = "all working";
  if (trouble.length > 2) hint = `${trouble.length} with trouble`;
  else if (trouble.length) hint = `${trouble.map((c) => c.name).join(" and ")} ${level === "down" ? "down" : "slow"}`;
  else if (unknown) hint = `${unknown} unknown`;
  return { value: `${working}/${networks.length}`, hint, level };
}
