import type { AgentTask } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

const taskTypeLabels: Record<string, string> = {
  autofix: "autocorrección",
  quality: "calidad",
  smoke: "smoke test",
  deploy: "despliegue",
  benchmark: "benchmark",
};

const executorLabels: Record<string, string> = {
  worker: "agente",
  github_dispatch: "GitHub Dispatch",
};

export function TaskList({ tasks }: { tasks: AgentTask[] }) {
  if (!tasks.length) return <div className="empty-decision"><div><strong>Cola despejada.</strong> No hay trabajo autónomo esperando.</div></div>;
  return (
    <div className="ops-list">
      {tasks.map((task) => (
        <article className="ops-row" key={task.id}>
          <div className="ops-main">
            <div className="ops-title">{task.projectName ?? "Portfolio"} · {task.summary}</div>
            <div className="ops-meta">{taskTypeLabels[task.type] ?? task.type} · {executorLabels[task.executor] ?? task.executor.replace("_", " ")} · prioridad {task.priority}</div>
            {task.lastError ? <div className="ops-error">{task.lastError}</div> : null}
          </div>
          <div className="ops-attempt">{task.attempt}/{task.maxAttempts}<small>intentos</small></div>
          <StatusPill status={task.status} />
        </article>
      ))}
    </div>
  );
}

