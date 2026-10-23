import { duration, formatTime } from "../lib/format";
import { DAYS, recentIncidents, type History } from "../lib/history";
import { Card, SectionTitle } from "./ui";

const RESOLVED_SHOWN = 30;

export default function Incidents({ history, now }: { history: History; now: number }) {
  const recent = recentIncidents(history, now);
  const incidents = [...recent.filter((i) => !i.end), ...recent.filter((i) => i.end).slice(0, RESOLVED_SHOWN)];
  return (
    <section>
      <SectionTitle>Past incidents</SectionTitle>
      <Card>
        {incidents.length ? (
          incidents.map((i) => (
            <div key={`${i.id}${i.start}`} className="flex items-start justify-between gap-4 border-t border-line px-5 py-4 first:border-t-0 sm:px-6">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">
                  {i.name} {i.level === "down" ? "down" : "having trouble"}
                </p>
                <p className="mt-0.5 text-[12.5px] text-dim">
                  {formatTime(i.start)}
                  {i.end ? ` to ${formatTime(i.end)}` : ", still going"} · {duration(i.start, i.end, now)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${i.end ? "bg-white/[0.07] text-white/70" : i.level === "down" ? "bg-bad/12 text-bad" : "bg-warn/12 text-warn"}`}
              >
                {i.end ? "Resolved" : "Ongoing"}
              </span>
            </div>
          ))
        ) : (
          <p className="px-5 py-5 text-[14px] text-muted sm:px-6">No incidents in the last {DAYS} days.</p>
        )}
      </Card>
    </section>
  );
}
