import { useState } from "react";
import { seconds } from "../lib/format";
import { NETWORKS_GROUP, visibleParts, type History, type Part, type Stats } from "../lib/history";
import LineChart, { durationMax, type ChartPoint } from "./LineChart";
import { Card, SectionTitle, Stat, type StatProps } from "./ui";

const HOUR = 3_600_000;
const ms = (n: number | undefined) => (n == null ? "—" : `${n} ms`);
const logo = (part: Part) => `networks/${part.id.replace(/^chain:/, "")}.svg`;

export default function Performance({ history, now }: { history: History; now: number }) {
  const parts = visibleParts(history);
  const networks = parts.filter((p) => p.group === NETWORKS_GROUP && p.stats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!parts.length) return null;
  const selected = networks.find((p) => p.id === selectedId) ?? networks[0];
  return (
    <section>
      <SectionTitle>Performance</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles(parts).map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
      {selected && (
        <div className="mt-3 space-y-3">
          <Card>
            <div className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-3 [scrollbar-width:none] sm:px-6">
              {networks.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  aria-pressed={p.id === selected.id}
                  className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors ${p.id === selected.id ? "bg-white/[0.08] text-white" : "text-muted hover:bg-white/[0.04] hover:text-white"}`}
                >
                  <img src={logo(p)} alt="" width={16} height={16} className="h-4 w-4 rounded-[4px]" />
                  {p.name}
                </button>
              ))}
            </div>
            <Charts key={selected.id} part={selected} now={now} />
          </Card>
          <Card>
            <table className="w-full text-left text-[13px] tabular-nums">
              <thead className="text-xs text-dim">
                <tr>
                  <th className="py-3 pl-5 font-normal sm:pl-6">Network</th>
                  <th className="px-3 font-normal">Node</th>
                  <th className="hidden px-3 font-normal sm:table-cell">24 h avg</th>
                  <th className="hidden px-3 font-normal md:table-cell">Block time</th>
                  <th className="hidden px-3 font-normal md:table-cell">Blocks</th>
                  <th className="py-3 pl-3 pr-5 text-right font-normal sm:pr-6">Confirm time</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((p) => (
                  <NetworkRow key={p.id} part={p} selected={p.id === selected.id} onSelect={() => setSelectedId(p.id)} />
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-dim">
        Measured from z5.gg's own readings of each chain, every minute. Confirm time is how long the chain currently takes to reach the blocks we wait for:
        the first figure for payments under $1,000, the second for larger ones. Node is how fast we read the chain.
      </p>
    </section>
  );
}

function tiles(parts: Part[]): StatProps[] {
  const stats = (id: string): Stats => parts.find((p) => p.id === id)?.stats ?? {};
  const delivery = stats("job:webhooks").deliverySeconds;
  return [
    { label: "Checkout", value: ms(stats("web").avgMs), hint: "avg on the server, 24 h" },
    { label: "API", value: ms(stats("api").avgMs), hint: "avg on the server, 24 h" },
    { label: "Webhook delivery", value: delivery == null ? "—" : seconds(delivery), hint: delivery == null ? "not enough yet" : "median, 7 days" },
  ];
}

function Charts({ part, now }: { part: Part; now: number }) {
  const series = part.series ?? [];
  const to = Math.floor(now / HOUR) * HOUR + HOUR;
  const from = to - 7 * 24 * HOUR;
  const confirm: ChartPoint[] = series.map(([hour, fast, full]) => ({
    at: hour * HOUR,
    value: fast == null ? null : fast / 1000,
    detail: full != null && full !== fast ? `${seconds(full / 1000)} from $1,000` : undefined,
  }));
  const node: ChartPoint[] = series.map(([hour, , , nodeMs]) => ({ at: hour * HOUR, value: nodeMs }));
  return (
    <div className="grid gap-8 px-5 py-5 sm:px-6 md:grid-cols-2">
      <LineChart title="Confirm time, under $1,000" points={confirm} format={seconds} from={from} to={to} roundMax={durationMax} />
      <LineChart title="Node response" points={node} format={(v) => `${Math.round(v)} ms`} from={from} to={to} />
    </div>
  );
}

function NetworkRow({ part, selected, onSelect }: { part: Part; selected: boolean; onSelect: () => void }) {
  const s = part.stats ?? {};
  const blocks = s.fastBlocks != null && s.blocks != null ? (s.fastBlocks === s.blocks ? `${s.blocks}` : `${s.fastBlocks}–${s.blocks}`) : "—";
  return (
    <tr onClick={onSelect} className={`cursor-pointer border-t border-line transition-colors ${selected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
      <td className="py-2.5 pl-5 sm:pl-6">
        <span className="flex items-center gap-2.5">
          <img src={logo(part)} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 rounded-[5px]" />
          {part.name}
        </span>
      </td>
      <td className="px-3 text-muted">{ms(s.ms)}</td>
      <td className="hidden px-3 text-muted sm:table-cell">{ms(s.avgMs)}</td>
      <td className="hidden px-3 text-muted md:table-cell">{s.blockMs == null ? "—" : seconds(s.blockMs / 1000)}</td>
      <td className="hidden px-3 text-muted md:table-cell">{blocks}</td>
      <td className="py-2.5 pl-3 pr-5 text-right sm:pr-6">{confirmTime(s)}</td>
    </tr>
  );
}

function confirmTime(s: Stats) {
  if (s.fastConfirmMs == null || s.confirmMs == null) return <span className="text-dim">measuring</span>;
  const fast = seconds(s.fastConfirmMs / 1000);
  const full = seconds(s.confirmMs / 1000);
  return fast === full ? full : `${fast}–${full}`;
}
