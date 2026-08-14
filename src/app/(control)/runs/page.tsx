import { RunList } from "@/components/run-list";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

export default async function RunsPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar eyebrow="Automation" title="Workflow runs" meta={`${data.portfolio.automationHealth}% healthy`} />
      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Execution ledger</p>
            <h2 className="section-title">Latest activity</h2>
          </div>
          <span className="section-kicker">Every stage remains auditable</span>
        </div>
        <RunList runs={data.runs} />
      </section>
    </>
  );
}

