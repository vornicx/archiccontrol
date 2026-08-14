import { Topbar } from "@/components/topbar";
import { qualityStandard, standardStats } from "@/quality/standard";

export default function QualityPage() {
  return (
    <>
      <Topbar eyebrow="Governance" title="Archic Quality Standard" meta={`Frozen ${qualityStandard.frozenAt}`} />
      <section className="standard-hero">
        <div>
          <span className="standard-version">v{qualityStandard.version}</span>
          <h2 className="page-title">Pass or fail. Evidence before opinion.</h2>
          <p>{qualityStandard.intent} This standard is derived from the frozen Archic Design System gate and is machine-readable so every runner evaluates the same contract.</p>
        </div>
        <div className="standard-stats" aria-label="Standard statistics">
          <div className="standard-stat"><strong>{standardStats.checks}</strong><span>Total checks</span></div>
          <div className="standard-stat"><strong>{standardStats.automated}</strong><span>Automated</span></div>
          <div className="standard-stat"><strong>{standardStats.hybrid}</strong><span>Hybrid</span></div>
        </div>
      </section>

      <section className="standard-sections">
        {qualityStandard.sections.map((section) => (
          <article className="standard-section" key={section.id}>
            <div className="standard-section-head">
              <h3>{section.code} · {section.name}</h3>
              <span className="pill">{section.checks.length} checks</span>
            </div>
            <ol>
              {section.checks.map((check) => (
                <li key={check.id}>{check.label}<span className="verification">{check.verification}</span></li>
              ))}
            </ol>
          </article>
        ))}
        <article className="standard-section">
          <div className="standard-section-head">
            <h3>I · {qualityStandard.polish.name}</h3>
            <span className="pill pill-failed">blocking</span>
          </div>
          <p>{qualityStandard.polish.label}</p>
        </article>
      </section>
    </>
  );
}

