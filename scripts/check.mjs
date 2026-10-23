// Checks z5.gg from outside, records the result in history.json and tells the workflow whether to
// publish the page. Telegram alerts come from the Cloudflare Worker in worker/, which runs every minute.
//
//   node scripts/check.mjs               run a check
//   node scripts/check.mjs --published   after a successful deploy, record it
//
// history.json is kept in the Actions cache between runs. If the cache is gone, the copy on the
// published page is restored; if that can't be read, the run stops rather than start over empty.
import fs from "node:fs";
import { isHistory, isPart, isPoint, LEVELS, MAX_SERIES, STATS } from "../shared/history.mjs";

const SITE = "https://z5.gg";
const PAGE = "https://status.z5.gg";
const HISTORY = "history.json";
const KEEP_DAYS = 90;
const KEEP_RESOLVED_INCIDENTS = 200;
const PUBLISH_EVERY_MS = 15 * 60_000;
const TRIES = 3;
const RETRY_MS = 20_000;
const TIMEOUT_MS = 20_000;
const DAY_MS = 86_400_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayOf = (date) => date.toISOString().slice(0, 10);
const request = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "z5-uptime", ...init.headers } });

async function checkSite() {
  let code = 0;
  let detail = "";
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await request(`${SITE}/api/health`);
      code = res.status;
      detail = (await res.text()).slice(0, 200);
      if (res.ok) return { up: true, code };
    } catch (err) {
      code = 0;
      detail = err.message;
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
async function readParts() {
  try {
    const res = await request(`${SITE}/api/status`);
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

const emptyHistory = () => ({ components: {}, incidents: [], last: null, publishedAt: null, publishPending: false });

/** The cached history, else the published one. A missing page means a first run; anything else is an error. */
async function loadHistory() {
  if (fs.existsSync(HISTORY)) {
    try {
      const cached = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
      if (isHistory(cached)) return cached;
    } catch {}
    console.log("cached history unreadable, restoring the published copy");
  }
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await request(`${PAGE}/history.json`);
      if (res.status === 404) return emptyHistory();
      const published = await res.json();
      if (res.ok && isHistory(published)) return published;
    } catch {}
    if (i < TRIES - 1) await sleep(RETRY_MS);
  }
  throw new Error("history can't be restored from the cache or the published page; not starting over");
}

function save(history) {
  fs.writeFileSync(HISTORY, JSON.stringify(history));
  fs.mkdirSync("site", { recursive: true });
  fs.copyFileSync(HISTORY, "site/history.json");
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

const levels = (parts) => JSON.stringify((parts ?? []).map((p) => [p.id, p.level]));

async function check() {
  const history = await loadHistory();
  const site = await checkSite();
  const parts = site.up ? await readParts() : null;
  const now = new Date();
  const at = now.toISOString();
  console.log(`z5.gg is ${site.up ? "up" : "down"} (${site.code || "no answer"}), components ${parts ? parts.length : "unavailable"}`);

  const reach = { id: "site", name: "z5.gg", group: "Reachability", note: "Answering from the outside, checked from GitHub", level: site.up ? "up" : "down" };
  const observed = [reach, ...(parts ?? [])];
  for (const part of observed) {
    recordDay(history, part, dayOf(now));
    recordIncident(history, part, at);
  }
  prune(history, now);

  const changed = levels(history.last?.components) !== levels(observed) || (history.last?.partsKnown ?? true) !== !!parts;
  const due = !history.publishedAt || now - new Date(history.publishedAt) >= PUBLISH_EVERY_MS || dayOf(new Date(history.publishedAt)) !== dayOf(now);
  const manual = (process.env.GITHUB_EVENT_NAME ?? "schedule") !== "schedule";
  history.publishPending = history.publishPending || changed || due || manual;
  history.last = { at, site: site.up ? "up" : "down", code: site.code || null, partsKnown: !!parts, order: observed.map((p) => p.id), components: observed };

  save(history);
  console.log(`publish: ${history.publishPending}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${history.publishPending}\n`);
}

function markPublished() {
  const history = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
  history.publishedAt = new Date().toISOString();
  history.publishPending = false;
  fs.writeFileSync(HISTORY, JSON.stringify(history));
}

if (process.argv.includes("--published")) markPublished();
else await check();
