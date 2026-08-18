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

function pageStatus(score: number): "passed" | "failed" | "needs_evidence" {
  if (score >= 80) return "passed";
  if (score < 70) return "failed";
  return "needs_evidence";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLiveProject(id);
  if (!data) notFound();
  const { project, rubric, gate } = data;
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
          <div className="row-meta">Benchmark</div>
          <StatusPill status={gate.status} />
        </div>
      </section>

      <section className="metric-strip" aria-label="Scorecard del proyecto">
        <div className="metric"><span className="metric-label">Benchmark</span><div className="metric-value">{project.score.toFixed(1)}<small>/100</small></div></div>
        <div className="metric metric-primary"><span className="metric-label">Archic Score</span><div className="metric-value">{rubric?.projectScore.toFixed(1) ?? "—"}<small>{rubric ? rubric.archicLevel : "pendiente"}</small></div></div>
        <div className="metric"><span className="metric-label">Mobile</span><div className="metric-value">{rubric?.mobileScore.toFixed(1) ?? "—"}<small>/100</small></div></div>
        <div className="metric"><span className="metric-label">AI Slop</span><div className="metric-value">{rubric ? `−${rubric.totalSlopPenalty}` : "—"}<small>{rubric ? `${rubric.highSlopFindings} alto(s)` : "sin revisar"}</small></div></div>
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

      <section className="section" aria-labelledby="archic-score-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Rúbrica ejecutable v1.0</p>
            <h2 className="section-title" id="archic-score-title">Archic Score por página</h2>
          </div>
          <span className="section-kicker">{rubric ? rubric.status.replaceAll("_", " ") : "pendiente de revisión"}</span>
        </div>
        {rubric ? (
          <div className="gate-checks">
            {rubric.pageScores.map((page) => (
              <article className="gate-check" key={page.path}>
                <StatusPill status={pageStatus(page.finalScore)} label={`${page.finalScore.toFixed(1)} / 100`} />
                <div>
                  <h3>{page.label}</h3>
                  <p>{page.mode} · {page.role.replaceAll("_", " ")} · mobile {page.mobileScore.toFixed(1)} · penalización slop −{page.slopPenalty}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <article className="standard-section">
            <div className="standard-section-head"><h3>Falta la revisión Archic</h3><span className="pill pill-needs_evidence">bloqueante</span></div>
            <p>El benchmark técnico no basta para llegar a cliente. Hay que persistir una revisión de Page Modes, Section Gates, mobile, S01–S50 y G01–G10.</p>
          </article>
        )}
      </section>

      {rubric && (rubric.hardGateFailures.length > 0 || rubric.sectionFailures.length > 0 || rubric.slopFindings.length > 0) ? (
        <section className="finding-list" aria-labelledby="rubric-findings-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Criterio Archic</p>
              <h2 className="section-title" id="rubric-findings-title">Bloqueos y slop de la última revisión</h2>
            </div>
            <span className="section-kicker">{rubric.hardGateFailures.length + rubric.sectionFailures.length + rubric.slopFindings.length} hallazgo(s)</span>
          </div>
          {rubric.hardGateFailures.map((failure) => (
            <article className="finding" key={failure.id}>
              <div className="finding-head"><h3>{failure.id} · {failure.name}</h3><StatusPill status="failed" /></div>
              <p>{failure.evidence}</p>
            </article>
          ))}
          {rubric.sectionFailures.map((failure) => (
            <article className="finding" key={`${failure.path}:${failure.sectionId}`}>
              <div className="finding-head"><h3>{failure.label}</h3><StatusPill status="needs_evidence" label={`${failure.score}/${failure.required}`} /></div>
              <p>{failure.path} · La sección no alcanza el Section Gate obligatorio.</p>
            </article>
          ))}
          {rubric.slopFindings.slice(0, 10).map((finding) => (
            <article className="finding" key={`${finding.path}:${finding.signalId}`}>
              <div className="finding-head"><h3>{finding.signalId} · {finding.label}</h3><StatusPill status={finding.severity} label={`${finding.severity} · −${finding.penalty}`} /></div>
              <p>{finding.path} · {finding.evidence}</p>
            </article>
          ))}
        </section>
      ) : null}

      {rubric?.topFixes.length ? (
        <section className="finding-list" aria-labelledby="fixes-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Siguiente pasada</p>
              <h2 className="section-title" id="fixes-title">Máximo impacto primero</h2>
            </div>
            <span className="section-kicker">{rubric.topFixes.length} corrección(es)</span>
          </div>
          {rubric.topFixes.map((fix, index) => (
            <article className="finding" key={`${index}:${fix}`}>
              <div className="finding-head"><h3>{index + 1}. {fix}</h3></div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="finding-list" aria-labelledby="findings-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Cola de agentes</p>
            <h2 className="section-title" id="findings-title">Incidencias abiertas del benchmark</h2>
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
