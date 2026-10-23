import { percent, timeAgo } from "../lib/format";
import { historySpan, isStale, lastDays, networkSummary, recentIncidents, SITE_ID, tally, verdict, type History, type Level } from "../lib/history";
import Backdrop from "./Backdrop";
import { Stat, type StatProps } from "./ui";

const TAIL_COLOR: Record<Level, string> = { up: "accent-text", degraded: "text-warn", down: "text-bad", unknown: "" };

interface Props {
  history: History | null;
  failed: boolean;
  now: number;
}

/** Hidden until the history has loaded, with its space kept, so nothing jumps or swaps text. */
export default function Hero({ history, failed, now }: Props) {
  const ready = !!history || failed;
  return (
    <section className="relative overflow-hidden pt-16">
      <Backdrop />
      <div className="relative mx-auto max-w-[1000px] px-5 pb-14 pt-10 sm:pb-20 sm:pt-24">
        <div className={ready ? "reveal" : "invisible"}>
          <Headline history={history} now={now} />
          <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted sm:mt-6 sm:text-lg">{intro(history, failed, now)}</p>
        </div>
        {(history || !failed) && (
          <div className={`mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:grid-cols-4 ${history ? "reveal" : "invisible"}`} style={{ animationDelay: "120ms" }}>
            {stats(history, now).map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const UNAVAILABLE = { level: "unknown" as Level, lead: "Status is", tail: "unavailable." };

function Headline({ history, now }: { history: History | null; now: number }) {
  const v = history ? verdict(history, now) : UNAVAILABLE;
  return (
    <h1 className="heading text-[42px] leading-[1.04] sm:text-6xl lg:text-[64px]">
      {v.lead}
      <br />
      <span className={TAIL_COLOR[v.level]}>{v.tail}</span>
    </h1>
  );
}

function intro(history: History | null, failed: boolean, now: number) {
  if (!history) return failed ? "The status couldn't be loaded. This page tries again every two minutes." : "";
  if (isStale(history, now)) return `The last check was ${timeAgo(history.last.at, now)}, later than usual, so this may be out of date.`;
  if (history.last.site !== "up")
    return `Three checks from outside in a row got no good answer${history.last.code ? ` (HTTP ${history.last.code})` : ""}. We're on it, and this page keeps updating.`;
  if (history.last.partsKnown === false) return "z5.gg answers from outside, but the state of its parts couldn't be read on the last check.";
  return "Checkout, the API, every network we watch and the money that moves through them. Checked from outside our servers, on a page that stays up when we don't.";
}

function stats(history: History | null, now: number): StatProps[] {
  if (!history) return ["z5.gg uptime", "Incidents", "Networks", "Last check"].map((label) => ({ label, value: "—", hint: "" }));
  const site = tally(history, [SITE_ID], lastDays(now));
  const span = historySpan(history, now);
  const networks = networkSummary(history);
  return [
    { label: "z5.gg uptime", value: site.total ? percent(site.ok, site.total) : "—", hint: span },
    { label: "Incidents", value: String(recentIncidents(history, now).length), hint: span },
    { label: "Networks", value: networks.value, hint: networks.hint, level: networks.level },
    { label: "Last check", value: timeAgo(history.last.at, now), hint: "from GitHub" },
  ];
}
