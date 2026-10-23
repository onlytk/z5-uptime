import type { ReactNode } from "react";
import { percent } from "../lib/format";
import { groupedIds, LEVEL_LABEL, levelReader, NETWORKS_GROUP, PHONE_DAYS, tally, worst, type History, type Level } from "../lib/history";
import DayBars from "./DayBars";
import { Card, Dot, LEVEL_TEXT, SectionTitle, StatusLabel } from "./ui";

const TILE_STYLE: Record<Level, string> = {
  up: "border-line bg-white/[0.02] hover:bg-white/[0.04]",
  unknown: "border-line bg-white/[0.02]",
  degraded: "border-warn/30 bg-warn/[0.06]",
  down: "border-bad/30 bg-bad/[0.06]",
};

export default function Groups({ history, days }: { history: History; days: string[] }) {
  const levelOf = levelReader(history);
  return groupedIds(history).map(({ group, ids }) => (
    <section key={group}>
      <SectionTitle>{group}</SectionTitle>
      <Card>
        {group === NETWORKS_GROUP ? (
          <Row name={`${ids.length} networks`} note={history.components[ids[0]].note} level={worst(ids.map(levelOf))}>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ids.map((id) => (
                <NetworkTile key={id} history={history} id={id} level={levelOf(id)} days={days} />
              ))}
            </div>
            <DayBars history={history} ids={ids} days={days} level={worst(ids.map(levelOf))} label={group} />
          </Row>
        ) : (
          ids.map((id) => (
            <Row key={id} name={history.components[id].name} note={history.components[id].note} level={levelOf(id)}>
              <DayBars history={history} ids={[id]} days={days} level={levelOf(id)} label={history.components[id].name} />
            </Row>
          ))
        )}
      </Card>
    </section>
  ));
}

function Row({ name, note, level, children }: { name: string; note: string; level: Level; children: ReactNode }) {
  return (
    <div className="border-t border-line px-5 py-5 first:border-t-0 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-medium">{name}</p>
          <p className="mt-0.5 text-[12.5px] text-dim">{note}</p>
        </div>
        <StatusLabel level={level} />
      </div>
      {children}
    </div>
  );
}

function NetworkTile({ history, id, level, days }: { history: History; id: string; level: Level; days: string[] }) {
  const { name } = history.components[id];
  const { total, ok } = tally(history, [id], days);
  const uptime = total ? `${percent(ok, total)} up` : null;
  return (
    <div title={`${name}: ${LEVEL_LABEL[level]}${uptime ? `, ${uptime}` : ""}`} className={`rounded-xl border px-3 pb-3 pt-2.5 transition-colors ${TILE_STYLE[level]}`}>
      <div className="flex items-center gap-3">
        <img src={`networks/${id.replace(/^chain:/, "")}.svg`} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-[6px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-tight">{name}</p>
          <p className={`text-[11.5px] ${level === "up" ? "text-dim" : LEVEL_TEXT[level]}`}>{level === "up" ? (uptime ?? LEVEL_LABEL.up) : LEVEL_LABEL[level]}</p>
        </div>
        <Dot level={level} />
      </div>
      <DayBars history={history} ids={[id]} days={days.slice(-PHONE_DAYS)} level={level} label={name} size="small" />
    </div>
  );
}
