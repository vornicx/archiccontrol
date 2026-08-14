import { PreviewList } from "@/components/preview-list";
import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { getAutomationData } from "@/lib/automation-repository";

export default async function DeploymentsPage() {
  const data = await getAutomationData();
  const ready = data.deploymentReadiness.every((check) => check.ready);
  return (
    <>
      <Topbar eyebrow="Promotion pipeline" title="Previews & deployments" meta={ready ? "Runtime configured" : "Environment incomplete"} />
      <section className="readiness-panel" aria-labelledby="readiness-title">
        <div><p className="eyebrow">Deployment contract</p><h2 className="section-title" id="readiness-title">Production readiness</h2></div>
        <div className="readiness-grid">
          {data.deploymentReadiness.map((check) => (
            <article className="readiness-check" key={check.label}>
              <div><strong>{check.label}</strong><span>{check.detail}</span></div>
              <StatusPill status={check.ready ? "passed" : "needs_evidence"} label={check.ready ? "ready" : "required"} />
            </article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-head"><div><p className="eyebrow">Immutable artifacts</p><h2 className="section-title">Promotion evidence</h2></div><span className="section-kicker">{data.counts.readyPreviews} approvable</span></div>
        <PreviewList previews={data.previews} />
      </section>
    </>
  );
}

