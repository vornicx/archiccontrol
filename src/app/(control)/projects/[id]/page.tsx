import { notFound } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { getLiveProject } from "@/lib/project-detail";
import { normalizeSeverity } from "@/quality/gate";
import { journeyManifests } from "@/automation/manifests";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLiveProject(id);
  if (!data) notFound();
  const { project, gate } = data;
  const journeys = journeyManifests.get(project.id);
  return (
    <>
      <Topbar eyebrow={project.profile.replaceAll("-", " ")} title={project.name} meta={project.repository} />
      <section className="project-hero">
        <div>
          <p className="eyebrow">Quality Gate v{gate.standardVersion}</p>
          <h2 className="page-title">{gate.summary}</h2>
          <p className="section-kicker">{gate.nextAction}</p>
        </div>
        <div>
          <div className="project-score-large">{project.score.toFixed(1)}<small>/100</small></div>
          <StatusPill status={gate.status} />
        </div>
      </section>

      <section className="gate-checks" aria-label="Quality Gate checks">
        <article className="gate-check">
          <StatusPill status={journeys ? "passed" : "failed"} label={journeys ? "configured" : "missing"} />
          <div><h3>Critical Playwright journeys</h3><p>{journeys ? `${journeys.journeys.length} project contracts · desktop and mobile` : "A versioned project journey manifest is required."}</p></div>
        </article>
        {gate.checks.map((check) => (
          <article className="gate-check" key={check.id}>
            <StatusPill status={check.status} />
            <div>
              <h3>{check.label}</h3>
              <p>{check.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="finding-list" aria-labelledby="findings-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Agent queue</p>
            <h2 className="section-title" id="findings-title">Open findings</h2>
          </div>
          <span className="section-kicker">{project.issues.length} surfaced</span>
        </div>
        {project.issues.map((issue) => (
          <article className="finding" key={issue.id}>
            <div className="finding-head">
              <h3>{issue.title}</h3>
              <StatusPill status={normalizeSeverity(issue.severity) === "critical" ? "failed" : "needs_evidence"} label={normalizeSeverity(issue.severity)} />
            </div>
            <p>{issue.detail}</p>
            {issue.recommendation ? <div className="finding-action">Autofix direction · {issue.recommendation}</div> : null}
          </article>
        ))}
      </section>
    </>
  );
}
