interface Props {
  value: number;
  max?: number;
  label?: string;
}

export function ProgressBar({ value, max = 100, label }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-ink-400 mb-1.5">
          <span>{label}</span>
          <span className="text-ink-200 font-medium">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
