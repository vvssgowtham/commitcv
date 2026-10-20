// Jobright score-ring: circular match indicator, mint value.
export function ScoreRing({ value, size = 64, label = "match", track = "#e5e7eb" }: { value: number; size?: number; label?: string; track?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${value}% ${label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-jr-mint)" strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute font-display font-bold" style={{ fontSize: size * 0.3 }}>{value}</span>
    </div>
  );
}
