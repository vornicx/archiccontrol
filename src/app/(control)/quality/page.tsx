import { Topbar } from "@/components/topbar";
import { qualityRubric } from "@/quality/rubric";
import { qualityStandard, standardStats } from "@/quality/standard";
import {
  qualityCheckLabels,
  qualityIntentEs,
  qualityPolishLabelEs,
  qualityPolishNameEs,
  qualitySectionLabels,
  qualityVerificationLabels,
} from "@/quality/i18n";

const criterionNames = Object.fromEntries(qualityRubric.criteria.map((criterion) => [criterion.id, criterion.name]));
const modeEntries = Object.entries(qualityRubric.page_modes) as Array<[string, Record<string, number>]>;
const highSlopCount = qualityRubric.ai_slop_detector.filter((signal) => signal.severity === "high").length;

export default function QualityPage() {
  return (
    <>
      <Topbar eyebrow="Gobernanza" title="Estándar de Calidad Archic" meta={`Gate v${qualityStandard.version} · Rubric v${qualityRubric.version}`} />

      <section className="section">
        <section className="standard-hero">
          <div>
            <span className="standard-version">Gate v{qualityStandard.version}</span>
            <h2 className="page-title">Se supera o no se supera. Evidencia antes que opinión.</h2>
            <p>{qualityIntentEs} El gate técnico sigue siendo vinculante: una puntuación nunca puede saltarse una condición bloqueante.</p>
          </div>
          <div className="standard-stats" aria-label="Estadísticas del estándar">
            <div className="standard-stat"><strong>{standardStats.checks}</strong><span>Comprobaciones</span></div>
            <div className="standard-stat"><strong>{standardStats.automated}</strong><span>Automáticas</span></div>
            <div className="standard-stat"><strong>{standardStats.hybrid}</strong><span>Híbridas</span></div>
          </div>
        </section>

        <section className="standard-sections">
          {qualityStandard.sections.map((section) => (
            <article className="standard-section" key={section.id}>
              <div className="standard-section-head">
                <h3>{section.code} · {qualitySectionLabels[section.id] ?? section.name}</h3>
                <span className="pill">{section.checks.length} comprobaciones</span>
              </div>
              <ol>
                {section.checks.map((check) => (
                  <li key={check.id}>{qualityCheckLabels[check.id] ?? check.label}<span className="verification">{qualityVerificationLabels[check.verification] ?? check.verification}</span></li>
                ))}
              </ol>
            </article>
          ))}
          <article className="standard-section">
            <div className="standard-section-head">
              <h3>I · {qualityPolishNameEs}</h3>
              <span className="pill pill-failed">bloqueante</span>
            </div>
            <p>{qualityPolishLabelEs}</p>
          </article>
        </section>
      </section>

      <section className="section">
        <section className="standard-hero">
          <div>
            <span className="standard-version">Rubric v{qualityRubric.version}</span>
            <h2 className="page-title">Criterio Archic ejecutable, separado del benchmark.</h2>
            <p>El Benchmark mide evidencia automática y técnica. El Archic Score mide si la experiencia está suficientemente bien resuelta para enseñarla a un cliente. Los dos son obligatorios; ninguno sustituye al otro.</p>
          </div>
          <div className="standard-stats" aria-label="Estadísticas de la rúbrica Archic">
            <div className="standard-stat"><strong>{modeEntries.length}</strong><span>Page Modes</span></div>
            <div className="standard-stat"><strong>{qualityRubric.ai_slop_detector.length}</strong><span>Señales slop</span></div>
            <div className="standard-stat"><strong>{qualityRubric.hard_gates.length}</strong><span>Hard gates</span></div>
          </div>
        </section>

        <section className="metric-strip" aria-label="Umbrales de calidad Archic">
          <div className="metric metric-primary"><span className="metric-label">Client-ready</span><div className="metric-value">{qualityRubric.approval_rules.client_ready_min_project_score}<small>/100 mínimo</small></div></div>
          <div className="metric"><span className="metric-label">Objetivo</span><div className="metric-value">{qualityRubric.approval_rules.recommended_target}<small>+</small></div></div>
          <div className="metric"><span className="metric-label">Flagship</span><div className="metric-value">{qualityRubric.approval_rules.flagship_min}<small>+</small></div></div>
          <div className="metric"><span className="metric-label">Mobile</span><div className="metric-value">{qualityRubric.approval_rules.mobile_min}<small>/100 mínimo</small></div></div>
        </section>

        <div className="section-head">
          <div>
            <p className="eyebrow">Page Mode Engine</p>
            <h2 className="section-title">Cada página tiene un trabajo dominante</h2>
          </div>
          <span className="section-kicker">Pesos distintos según intención</span>
        </div>
        <section className="standard-sections">
          {modeEntries.map(([mode, weights]) => {
            const priorities = Object.entries(weights)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <article className="standard-section" key={mode}>
                <div className="standard-section-head">
                  <h3>{mode}</h3>
                  <span className="pill">100 puntos</span>
                </div>
                <ol>
                  {priorities.map(([criterion, weight]) => (
                    <li key={criterion}>{criterionNames[criterion] ?? criterion}<span className="verification">{weight}%</span></li>
                  ))}
                </ol>
              </article>
            );
          })}
        </section>

        <div className="section-head">
          <div>
            <p className="eyebrow">Release boundary</p>
            <h2 className="section-title">Lo que bloquea una entrega aunque se vea bien</h2>
          </div>
          <span className="section-kicker">0 excepciones silenciosas</span>
        </div>
        <section className="standard-sections">
          <article className="standard-section">
            <div className="standard-section-head"><h3>Hard gates G01–G10</h3><span className="pill pill-failed">bloqueantes</span></div>
            <ol>{qualityRubric.hard_gates.map((gate) => <li key={gate.id}><strong>{gate.id}</strong> · {gate.name}</li>)}</ol>
          </article>
          <article className="standard-section">
            <div className="standard-section-head"><h3>AI Slop Detector S01–S50</h3><span className="pill">{highSlopCount} severidad alta</span></div>
            <p>Una señal de severidad alta bloquea client-ready. A partir de {qualityRubric.approval_rules.max_total_slop_penalty_before_rework} puntos de penalización total, la página vuelve a rework aunque el score bruto sea alto.</p>
            <p className="section-kicker">Incluye Fake Quiet Luxury, Luxury Information Hiding, Case Study Without Case, Motion Résumé y Responsive Preservation.</p>
          </article>
          <article className="standard-section">
            <div className="standard-section-head"><h3>Section Gate</h3><span className="pill">20 puntos</span></div>
            <p>Sección normal ≥ {qualityRubric.section_scoring.pass_min}/20 · Hero ≥ {qualityRubric.section_scoring.hero_min}/20. Se puntúan propósito, especificidad, jerarquía, composición y handoff.</p>
          </article>
          <article className="standard-section">
            <div className="standard-section-head"><h3>Golden Eight</h3><span className="pill">principios, no copias</span></div>
            <p>{Object.keys(qualityRubric.golden_references).join(" · ")}</p>
          </article>
        </section>
      </section>
    </>
  );
}
