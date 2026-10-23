export const LEVELS = ["up", "degraded", "down", "unknown"];
export const STATS = ["ms", "avgMs", "blocks", "fastBlocks", "blockMs", "fastConfirmMs", "confirmMs", "deliverySeconds"];
export const MAX_SERIES = 200;

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isTime = (v) => isText(v) && !Number.isNaN(Date.parse(v));
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const optional = (check) => (v) => v === undefined || check(v);
const orNull = (check) => (v) => v === null || check(v);

const isStats = (v) => isObject(v) && Object.entries(v).every(([key, n]) => STATS.includes(key) && isCount(n));

/** Hourly points: [hours since 1970, confirm ms under $1,000, confirm ms above, node ms]. */
export const isPoint = (v) => Array.isArray(v) && v.length === 4 && isCount(v[0]) && v.slice(1).every(orNull(isCount));
const isSeries = (v) => Array.isArray(v) && v.length <= MAX_SERIES && v.every(isPoint);

export const isPart = (p) =>
  isObject(p) && isText(p.id) && p.id !== "" && isText(p.name) && isText(p.group) && isText(p.note) && LEVELS.includes(p.level) &&
  optional(isStats)(p.stats) && optional(isSeries)(p.series);

const isComponent = (c) =>
  isObject(c) && isText(c.name) && isText(c.group) && isText(c.note) && isObject(c.days) &&
  Object.entries(c.days).every(([day, n]) => isDay(day) && Array.isArray(n) && n.length === 2 && isCount(n[0]) && isCount(n[1]) && n[1] <= n[0]);

const isIncident = (i) =>
  isObject(i) && isText(i.id) && isText(i.name) && (i.level === "down" || i.level === "degraded") && isTime(i.start) && orNull(isTime)(i.end);

const isSite = (v) => v === "up" || v === "down";

const isLast = (l) =>
  isObject(l) && isTime(l.at) && isSite(l.site) && Array.isArray(l.components) && l.components.every(isPart) &&
  optional(orNull(isCount))(l.code) &&
  optional(isBool)(l.partsKnown) &&
  optional((v) => Array.isArray(v) && v.every(isText))(l.order);

/** True when every record the page and the check script read is well-formed. Fields added later may be absent. */
export function isHistory(h) {
  return (
    isObject(h) &&
    isObject(h.components) &&
    Object.values(h.components).every(isComponent) &&
    Array.isArray(h.incidents) &&
    h.incidents.every(isIncident) &&
    (h.last === null || isLast(h.last)) &&
    optional(orNull(isTime))(h.publishedAt) &&
    optional(orNull(isSite))(h.notified) &&
    optional(isBool)(h.publishPending)
  );
}
