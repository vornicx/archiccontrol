import type { WorkflowRun } from "@/lib/types";

const stageLabels: Record<string, string> = {
  benchmark: "benchmark",
  quality: "calidad",
  build: "construcción",
  test: "pruebas",
  smoke: "smoke test",
  deploy: "despliegue",
  deployment: "despliegue",
  approval: "aprobación",
  autofix: "autocorrección",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function RunList({ runs }: { runs: WorkflowRun[] }) {
  return (
    <div className="run-list">
      {runs.map((run) => (
        <article className="run-item" data-status={run.status} key={run.id}>
          <span className="run-marker" aria-hidden="true" />
          <div>
            <div className="run-name">{run.projectName ?? "Portfolio"} · {stageLabels[run.stage] ?? run.stage}</div>
            <div className="run-summary">{run.summary ?? run.workflow}</div>
          </div>
          <time className="run-time" dateTime={run.startedAt}>{formatTime(run.startedAt)}</time>
        </article>
      ))}
    </div>
  );
}
