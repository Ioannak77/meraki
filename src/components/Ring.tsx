// A soft progress ring like the ones at the top of the Today screen.

export function Ring({
  value,
  max,
  color,
  label,
  children,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  const r = 26;
  const length = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-[68px] md:size-20">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-[15px] font-bold md:text-lg">{children}</div>
      </div>
      <span className="text-xs text-muted md:text-sm">{label}</span>
    </div>
  );
}
