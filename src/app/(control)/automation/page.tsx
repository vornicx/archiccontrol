import { StatusPill } from "@/components/status-pill";
import { TaskList } from "@/components/task-list";
import { Topbar } from "@/components/topbar";
import { getAutomationHealth } from "@/lib/automation-health";
import { getAutomationData } from "@/lib/automation-repository";

export default async function AutomationPage() {
  const [data, health] = await Promise.all([getAutomationData(), getAutomationHealth()]);
  const readiness = data.deploymentReadiness.filter((item) => item.label !== "Owner authentication");

  return (
    <>
      <Topbar eyebrow="Autonomous runtime" title="Agent queue" meta={`${health.score}% · ${health.state}`} />
      <section className="metric-strip compact-metrics" aria-label="Agent runtime metrics">
        <div className="metric"><span className="metric-label">Queued</span><div className="metric-value">{data.counts.queued}</div></div>
        <div className="metric"><span className="metric-label">Running</span><div className="metric-value">{data.counts.running}</div></div>
        <div className="metric"><span className="metric-label">Blocked</span><div className="metric-value">{data.counts.blocked}</div></div>
        <div className="metric"><span className="metric-label">Stale queued</span><div className="metric-value">{health.staleQueued}</div></div>
      </section>

      <section className="section" aria-labelledby="runtime-readiness-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Execution plane</p>
            <h2 className="section-title" id="runtime-readiness-title">Runtime readiness</h2>
          </div>
          <span className="section-kicker">{health.detail}</span>
        </div>
        <div className="gate-checks">
          {readiness.map((item) => (
            <article className="gate-check" key={item.label}>
              <StatusPill status={item.ready ? "passed" : "failed"} label={item.ready ? "ready" : "missing"} />
              <div><h3>{item.label}</h3><p>{item.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><p className="eyebrow">Leased and auditable</p><h2 className="section-title">Work owned by Control</h2></div><span className="section-kicker">Priority first · idempotent</span></div>
        <TaskList tasks={data.tasks} />
      </section>
    </>
  );
}
