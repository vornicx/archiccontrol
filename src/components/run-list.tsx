import type { WorkflowRun } from "@/lib/types";

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
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
            <div className="run-name">{run.projectName ?? "Portfolio"} · {run.stage}</div>
            <div className="run-summary">{run.summary ?? run.workflow}</div>
          </div>
          <time className="run-time" dateTime={run.startedAt}>{formatTime(run.startedAt)}</time>
        </article>
      ))}
    </div>
  );
}

