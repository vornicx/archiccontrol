import { TaskList } from "@/components/task-list";
import { Topbar } from "@/components/topbar";
import { getAutomationData } from "@/lib/automation-repository";

export default async function AutomationPage() {
  const data = await getAutomationData();
  return (
    <>
      <Topbar eyebrow="Autonomous runtime" title="Agent queue" meta={`${data.counts.running} active`} />
      <section className="metric-strip compact-metrics" aria-label="Agent runtime metrics">
        <div className="metric"><span className="metric-label">Queued</span><div className="metric-value">{data.counts.queued}</div></div>
        <div className="metric"><span className="metric-label">Running</span><div className="metric-value">{data.counts.running}</div></div>
        <div className="metric"><span className="metric-label">Blocked</span><div className="metric-value">{data.counts.blocked}</div></div>
        <div className="metric"><span className="metric-label">Retry policy</span><div className="metric-value">3<small>before Vadim</small></div></div>
      </section>
      <section>
        <div className="section-head"><div><p className="eyebrow">Leased and auditable</p><h2 className="section-title">Work owned by Control</h2></div><span className="section-kicker">Priority first · idempotent</span></div>
        <TaskList tasks={data.tasks} />
      </section>
    </>
  );
}

