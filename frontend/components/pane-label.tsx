type PaneLabelProps = {
  index: string;
  label: string;
  hint?: string;
};

export function PaneLabel({ index, label, hint }: PaneLabelProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-rule px-5 text-[10px] uppercase tracking-[0.28em] text-ink-muted">
      <div className="flex items-center gap-3">
        <span className="font-mono text-ember">{index}</span>
        <span>{label}</span>
      </div>
      {hint ? <span className="hidden sm:inline text-ink-muted/70">{hint}</span> : null}
    </div>
  );
}
