import { notFound } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { getLiveProject } from "@/lib/project-detail";
import { normalizeSeverity } from "@/quality/gate";
import { journeyManifests } from "@/automation/manifests";

const severityLabels = {
  critical: "crítico",
  high: "alto",
  medium: "medio",
  low: "bajo",
} as const;

function profileLabel(profile: string): string {
  const labels: Record<string, string> = {
    "luxury-real-estate": "inmobiliaria de lujo",
    "luxury-hospitality": "hospitalidad de lujo",
    "luxury-automotive": "automoción de lujo",
    "premium-service": "servicio premium",
    "restaurant": "restauración",
  };
  return labels[profile] ?? profile.replaceAll("-", " ");
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLiveProject(id);
  if (!data) notFound();
  const { project, gate } = data;
  const journeys = journeyManifests.get(project.id);
  return (
    <>
      <Topbar eyebrow={profileLabel(project.profile)} title={project.name} meta={project.repository} />
      <section className="project-hero">
        <div>
          <p className="eyebrow">Gate de calidad v{gate.standardVersion}</p>
          <h2 className="page-title">{gate.summary}</h2>
          <p className="section-kicker">{gate.nextAction}</p>
        </div>
        <div>
          <div className="project-score-large">{project.score.toFixed(1)}<small>/100</small></div>
          <StatusPill status={gate.status} />
        </div>
      </section>

      <section className="gate-checks" aria-label="Comprobaciones del gate de calidad">
        <article className="gate-check">
          <StatusPill status={journeys ? "passed" : "failed"} label={journeys ? "configurado" : "falta configurar"} />
          <div><h3>Recorridos críticos de Playwright</h3><p>{journeys ? `${journeys.journeys.length} contratos de proyecto · escritorio y móvil` : "Se necesita un manifiesto versionado con los recorridos críticos del proyecto."}</p></div>
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
            <p className="eyebrow">Cola de agentes</p>
            <h2 className="section-title" id="findings-title">Incidencias abiertas</h2>
          </div>
          <span className="section-kicker">{project.issues.length} detectadas</span>
        </div>
        {project.issues.map((issue) => {
          const severity = normalizeSeverity(issue.severity);
          return (
            <article className="finding" key={issue.id}>
              <div className="finding-head">
                <h3>{issue.title}</h3>
                <StatusPill status={severity === "critical" ? "failed" : "needs_evidence"} label={severityLabels[severity]} />
              </div>
              <p>{issue.detail}</p>
              {issue.recommendation ? <div className="finding-action">Dirección para autocorrección · {issue.recommendation}</div> : null}
            </article>
          );
        })}
      </section>
    </>
  );
}
