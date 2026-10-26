// Every five minutes: checks z5.gg from outside and records the result in the history the status
// page reads. Telegram alerts come from alerts.js, every minute.
//
// The history lives in KV under "history". If it's gone, the copy on the page is restored; if that
// can't be read either, the run stops rather than start over empty.
import { isHistory, isPart, isPoint, LEVELS, MAX_SERIES, STATS } from "../shared/history.mjs";

const SITE = "https://z5.gg";
const PAGE = "https://status.z5.gg";
export const HISTORY = "history";
const KEEP_DAYS = 90;
const KEEP_RESOLVED_INCIDENTS = 200;
const TRIES = 3;
const RETRY_MS = 20_000;
const TIMEOUT_MS = 20_000;
const DAY_MS = 86_400_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayOf = (date) => date.toISOString().slice(0, 10);
const request = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "z5-uptime", ...init.headers }, cf: { cacheTtl: 0 } });

async function checkSite(site) {
  let code = 0;
  let detail = "";
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await request(`${site}/api/health`);
      code = res.status;
      detail = (await res.text()).slice(0, 200);
      if (res.ok) return { up: true, code };
    } catch (err) {
      code = 0;
      detail = String(err?.message ?? err);
    }
    if (i < TRIES - 1) await sleep(RETRY_MS);
  }
  return { up: false, code, detail };
}

const camel = (key) => key.replace(/_(\w)/g, (_, c) => c.toUpperCase());

/** Timings from /api/status (latency, block and confirm times, delivery median) as whole numbers. */
const statsOf = (c) =>
  Object.fromEntries(Object.entries(c ?? {}).filter(([key, n]) => STATS.includes(camel(key)) && Number.isInteger(n) && n >= 0).map(([key, n]) => [camel(key), n]));

/** The last week, hourly, for the charts. Malformed points are dropped, not the whole part. */
const seriesOf = (c) => (Array.isArray(c?.series) ? c.series.filter(isPoint).slice(-MAX_SERIES) : []);

/**
 * The parts behind z5.gg, or null when they couldn't be read. An unrecognised level becomes
 * unknown; an empty list or any malformed entry makes the whole list unavailable.
 */
async function readParts(site) {
  try {
    const res = await request(`${site}/api/status`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { components } = await res.json();
    if (!Array.isArray(components) || !components.length) throw new Error("no component list");
    const parts = components.map((c) => ({ id: c?.id, name: c?.name, group: c?.group, note: c?.note, level: LEVELS.includes(c?.level) ? c.level : "unknown", stats: statsOf(c), series: seriesOf(c) }));
    if (!parts.every(isPart)) throw new Error("malformed component list");
    return parts;
  } catch (err) {
    console.log(`components unavailable: ${err.message}`);
    return null;
  }
}

const emptyHistory = () => ({ components: {}, incidents: [], last: null });

/** The stored history, else the one on the page. A page that says 404 means a first run; anything else is an error. */
async function loadHistory(env) {
  try {
    const stored = await env.STATE.get(HISTORY, { type: "json" });
    if (isHistory(stored)) return stored;
    if (stored !== null) console.log("stored history unreadable, restoring the page's copy");
  } catch {
    console.log("stored history unreadable, restoring the page's copy");
  }
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await request(`${env.PAGE ?? PAGE}/history.json`);
      if (res.status === 404) return emptyHistory();
      const published = await res.json();
      if (res.ok && isHistory(published)) return published;
    } catch {}
    if (i < TRIES - 1) await sleep(RETRY_MS);
  }
  throw new Error("history can't be restored from KV or the page; not starting over");
}

/** Degraded still counts as up; unknown isn't counted. Counted on the day the observation was made. */
function recordDay(history, part, day) {
  const component = (history.components[part.id] ??= { days: {} });
  Object.assign(component, { name: part.name, group: part.group, note: part.note });
  if (part.level === "unknown") return;
  const counts = (component.days[day] ??= [0, 0]);
  counts[0] += 1;
  if (part.level !== "down") counts[1] += 1;
}

/** Open while a part is down or degraded, closed once it's seen up again; unknown changes nothing. */
function recordIncident(history, part, at) {
  const open = history.incidents.find((i) => i.id === part.id && !i.end);
  if (part.level === "down" || part.level === "degraded") {
    if (!open) history.incidents.push({ id: part.id, name: part.name, level: part.level, start: at, end: null });
    else if (part.level === "down") open.level = "down";
  } else if (part.level === "up" && open) {
    open.end = at;
  }
}

/** Keeps exactly the last 90 dates. Ongoing incidents are always kept; resolved ones are capped. */
function prune(history, now) {
  const first = dayOf(new Date(now.getTime() - (KEEP_DAYS - 1) * DAY_MS));
  for (const component of Object.values(history.components))
    for (const day of Object.keys(component.days)) if (day < first) delete component.days[day];
  const open = history.incidents.filter((i) => !i.end);
  const resolved = history.incidents.filter((i) => i.end && i.end.slice(0, 10) >= first).slice(-KEEP_RESOLVED_INCIDENTS);
  history.incidents = [...resolved, ...open].sort((a, b) => a.start.localeCompare(b.start));
}

export async function check(env) {
  const history = await loadHistory(env);
  const site = await checkSite(env.SITE ?? SITE);
  const parts = site.up ? await readParts(env.SITE ?? SITE) : null;
  const now = new Date();
  const at = now.toISOString();
  console.log(`z5.gg is ${site.up ? "up" : "down"} (${site.code || "no answer"}), components ${parts ? parts.length : "unavailable"}`);

  const reach = { id: "site", name: "z5.gg", group: "Reachability", note: "Answering from the outside, checked from Cloudflare", level: site.up ? "up" : "down" };
  const observed = [reach, ...(parts ?? [])];
  for (const part of observed) {
    recordDay(history, part, dayOf(now));
    recordIncident(history, part, at);
  }
  prune(history, now);

  // left over from publishing through GitHub Pages
  delete history.publishedAt;
  delete history.publishPending;
  history.last = { at, site: site.up ? "up" : "down", code: site.code || null, partsKnown: !!parts, order: observed.map((p) => p.id), components: observed };

  await env.STATE.put(HISTORY, JSON.stringify(history));
}
