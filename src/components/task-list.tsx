import type { AgentTask } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

export function TaskList({ tasks }: { tasks: AgentTask[] }) {
  if (!tasks.length) return <div className="empty-decision"><div><strong>Queue clear.</strong>No autonomous work is waiting.</div></div>;
  return (
    <div className="ops-list">
      {tasks.map((task) => (
        <article className="ops-row" key={task.id}>
          <div className="ops-main">
            <div className="ops-title">{task.projectName ?? "Portfolio"} · {task.summary}</div>
            <div className="ops-meta">{task.type} · {task.executor.replace("_", " ")} · priority {task.priority}</div>
            {task.lastError ? <div className="ops-error">{task.lastError}</div> : null}
          </div>
          <div className="ops-attempt">{task.attempt}/{task.maxAttempts}<small>attempts</small></div>
          <StatusPill status={task.status} />
        </article>
      ))}
    </div>
  );
}

