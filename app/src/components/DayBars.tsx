import { formatDay, percent, plural } from "../lib/format";
import { DAYS, PHONE_DAYS, tally, type History, type Level } from "../lib/history";

const TODAY_COLOR: Record<Level, string> = { up: "bg-good/80", degraded: "bg-warn/85", down: "bg-bad/85", unknown: "bg-white/[0.06]" };

function color(share: number | null) {
  if (share == null) return "bg-white/[0.06]";
  if (share >= 0.999) return "bg-good/80";
  if (share >= 0.99) return "bg-lime-300/80";
  if (share >= 0.95) return "bg-warn/85";
  return "bg-bad/85";
}

interface Props {
  history: History;
  ids: string[];
  days: string[];
  level: Level;
  label: string;
  size?: "large" | "small";
}

/**
 * One bar per day, coloured by the share of checks that were fine. Today's bar, until its first
 * check lands, shows the current level instead of looking empty.
 */
export default function DayBars({ history, ids, days, level, label, size = "large" }: Props) {
  const today = days[days.length - 1];
  const cells = days.map((day) => {
    const { total, ok } = tally(history, ids, [day]);
    const share = total ? ok / total : null;
    return {
      day,
      color: share == null && day === today ? TODAY_COLOR[level] : color(share),
      tip: `${formatDay(day)} · ${share != null ? `${percent(ok, total)} up (${plural(total, "check")})` : day === today ? "today, first check on its way" : "no data"}`,
    };
  });

  if (size === "small")
    return (
      <div className="mt-2.5 flex h-3.5 gap-px" role="img" aria-label={`${label}, last ${days.length} days`}>
        {cells.map((c) => (
          <span key={c.day} className={`flex-1 rounded-[2px] ${c.color}`} title={c.tip} />
        ))}
      </div>
    );

  const { total, ok } = tally(history, ids, days);
  const first = days.find((day) => tally(history, ids, [day]).total);
  const since = first === days[0] ? `over ${DAYS} days` : first ? `since ${formatDay(first)}` : "";
  const summary = total ? `${percent(ok, total)} up ${since}` : "No data yet";

  return (
    <>
      <div className="mt-4 flex h-8 gap-[2px]" role="img" aria-label={`${label}: ${summary}`}>
        {cells.map((c, i) => (
          <span key={c.day} className={`flex-1 rounded-[2px] transition-opacity hover:opacity-70 ${c.color} ${i < DAYS - PHONE_DAYS ? "hidden sm:block" : ""}`} title={c.tip} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-dim">
        <span>
          <span className="hidden sm:inline">{DAYS} days ago</span>
          <span className="sm:hidden">{PHONE_DAYS} days ago</span>
        </span>
        <span>{summary}</span>
        <span>Today</span>
      </div>
    </>
  );
}
