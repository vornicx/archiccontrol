export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`pill pill-${status}`}>{label ?? status.replaceAll("_", " ")}</span>;
}

