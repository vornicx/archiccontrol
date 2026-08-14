import { DecisionCard } from "@/components/decision-card";
import { ProjectList } from "@/components/project-list";
import { RunList } from "@/components/run-list";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function OverviewPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar title="Operating overview" meta={formatTimestamp(data.generatedAt)} />
      <section className="metric-strip" aria-label="Portfolio metrics">
        <div className="metric metric-primary">
          <span className="metric-label">Needs Vadim</span>
          <div className="metric-value">{data.needsVadim.length}<small>decision{data.needsVadim.length === 1 ? "" : "s"}</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Portfolio quality</span>
          <div className="metric-value">{data.portfolio.score.toFixed(1)}<small>/100</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Active gates</span>
          <div className="metric-value">{data.portfolio.activeGates}<small>blocking</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Automation health</span>
          <div className="metric-value">{data.portfolio.automationHealth}<small>%</small></div>
        </div>
      </section>

      <div className="content-grid">
        <div>
          <section className="section" aria-labelledby="needs-vadim-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Human boundary</p>
                <h2 className="section-title" id="needs-vadim-title">Needs Vadim</h2>
              </div>
              <span className="section-kicker">Everything else stays with Control</span>
            </div>
            {data.needsVadim.length
              ? data.needsVadim.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
              : <div className="empty-decision"><div><strong>No decisions waiting.</strong>Control is resolving the operational queue autonomously.</div></div>}
          </section>

          <section className="section" aria-labelledby="projects-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Active portfolio</p>
                <h2 className="section-title" id="projects-title">Quality progression</h2>
              </div>
              <span className="section-kicker">{data.projects.length} projects</span>
            </div>
            <ProjectList projects={data.projects} />
          </section>
        </div>

        <aside className="section" aria-labelledby="runs-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Autonomous work</p>
              <h2 className="section-title" id="runs-title">Recent runs</h2>
            </div>
          </div>
          <RunList runs={data.runs} />
        </aside>
      </div>
    </>
  );
}

