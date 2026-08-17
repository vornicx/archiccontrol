import { Topbar } from "@/components/topbar";
import { qualityStandard, standardStats } from "@/quality/standard";
import {
  qualityCheckLabels,
  qualityIntentEs,
  qualityPolishLabelEs,
  qualityPolishNameEs,
  qualitySectionLabels,
  qualityVerificationLabels,
} from "@/quality/i18n";

export default function QualityPage() {
  return (
    <>
      <Topbar eyebrow="Gobernanza" title="Estándar de Calidad Archic" meta={`Congelado ${qualityStandard.frozenAt}`} />
      <section className="standard-hero">
        <div>
          <span className="standard-version">v{qualityStandard.version}</span>
          <h2 className="page-title">Se supera o no se supera. Evidencia antes que opinión.</h2>
          <p>{qualityIntentEs} Este estándar deriva del gate congelado del Archic Design System y es legible por máquina para que todos los agentes evalúen exactamente el mismo contrato.</p>
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
    </>
  );
}

