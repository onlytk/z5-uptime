const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 8, strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: 2 } as const;

const JUICE = [
  { y: 14, dx: -11, dy: -6 },
  { y: 27, dx: 12, dy: -8 },
  { y: 40, dx: -12, dy: 6 },
  { y: 52, dx: 10, dy: 9 },
];

export default function Logo() {
  return (
    <span className="logo inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-[22px] w-[22px] overflow-visible text-white" aria-hidden>
        <g className="part mark">
          <g className="part z" {...STROKE}>
            <path d="M5 12H29.5" />
            <path d="M33 12L5 52H29.5" />
          </g>
          <g className="part five" {...STROKE}>
            <path d="M29 12H57" />
            <path d="M33 12V30H46A11 11 0 0 1 46 52H29" />
          </g>
        </g>
        {JUICE.map((j, i) => (
          <circle key={j.y} className="part juice" cx={29} cy={j.y} r="2.6" style={{ ["--dx" as string]: `${j.dx}px`, ["--dy" as string]: `${j.dy}px`, animationDelay: `${470 + i * 25}ms` }} />
        ))}
        <line className="blade" x1="29" y1="-8" x2="29" y2="72" pathLength={100} />
      </svg>
      <span className="heading text-lg leading-none">
        zero<span className="text-white/55">five</span>
      </span>
    </span>
  );
}
