import { Topbar } from "@/components/topbar";
import { StatusPill } from "@/components/status-pill";
import { getProspectingData } from "@/prospecting/repository";
import type { ProspectRecord } from "@/prospecting/types";

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
}

function prospectStatus(prospect: ProspectRecord): "passed" | "failed" | "needs_evidence" {
  return prospect.status === "ready" ? "passed" : prospect.status === "blocked" ? "failed" : "needs_evidence";
}

function prototypeHref(prospect: ProspectRecord): string | null {
  const prototype = prospect.research.prototype as { repository?: unknown; branch?: unknown; path?: unknown } | undefined;
  if (!prototype?.repository || !prototype.branch || !prototype.path) return null;
  return `https://github.com/${String(prototype.repository)}/blob/${encodeURIComponent(String(prototype.branch))}/${String(prototype.path)}`;
}

function ProspectCard({ prospect }: { prospect: ProspectRecord }) {
  const prototypeUrl = prototypeHref(prospect);
  const fitReason = String(
    prospect.research.fitReason ||
      prospect.research.whyStrong ||
      prospect.research.summary ||
      prospect.error ||
      "Verified prospecting opportunity",
  );
  const websiteGap = prospect.research.websiteGap || prospect.research.salesAngle;

  return (
    <article className="decision-card">
      <span className="decision-type">{prospect.category || "Prospect"} · {prospect.city || "Spain"}</span>
      <h3>{prospect.name}</h3>
      <p>{fitReason}</p>
      <div className="decision-recommendation">
        <strong>Commercial read</strong>
        <p>
          Score {scoreLabel(prospect.score)} · Verification {prospect.verificationConfidence} · Status{" "}
          <StatusPill status={prospectStatus(prospect)} label={prospect.status} />
        </p>
        {websiteGap ? <p>{String(websiteGap)}</p> : null}
        {prospect.price.target ? (
          <p>
            <strong>Recommended target</strong>€{Number(prospect.price.target).toLocaleString("en-US")}
            {prospect.price.maintenanceMonthly ? ` + €${Number(prospect.price.maintenanceMonthly).toLocaleString("en-US")}/month` : ""}
          </p>
        ) : null}
      </div>
      <div className="decision-recommendation">
        <strong>Evidence</strong>
        {prospect.evidence.length ? prospect.evidence.map((item, index) => (
          <p key={`${item.url}-${item.sourceName}-${index}`}>
            <a href={item.url} target="_blank" rel="noreferrer">{item.sourceName}</a>
            {item.detail ? ` · ${item.detail}` : ""}{item.observedAt ? ` · ${item.observedAt}` : ""}
          </p>
        )) : <p>No evidence bundle stored.</p>}
      </div>
      <div className="decision-recommendation">
        <strong>Prototype & handoff</strong>
        <p>
          {prospect.deploymentUrl ? <><a href={prospect.deploymentUrl} target="_blank" rel="noreferrer">Open live prototype</a>{" · "}</> : null}
          {prototypeUrl ? <><a href={prototypeUrl} target="_blank" rel="noreferrer">Open exact prototype</a>{" · "}</> : null}
          {prospect.repositoryFullName ? <a href={`https://github.com/${prospect.repositoryFullName}`} target="_blank" rel="noreferrer">Open GitHub repository</a> : null}
          {!prospect.deploymentUrl && !prototypeUrl && !prospect.repositoryFullName ? "Publishing has not completed." : null}
        </p>
        {prospect.outreach.message ? <p><strong>Suggested outreach</strong>{prospect.outreach.message}</p> : null}
        {prospect.error ? <p><strong>Blocker</strong>{prospect.error}</p> : null}
      </div>
    </article>
  );
}

export default async function ProspectsPage() {
  const data = await getProspectingData();
  const todayIds = new Set(data.todayProspects.map((prospect) => prospect.id));
  const history = data.recent.filter((prospect) => !todayIds.has(prospect.id));

  return (
    <>
      <Topbar eyebrow="Commercial engine" title="Daily prospecting" meta="Independent opportunities · approval before outreach" />

      <section className="standard-hero">
        <div>
          <p className="eyebrow">Selection policy</p>
          <h2 className="page-title">Verified operating status before build spend.</h2>
          <p>Control researches multiple businesses, rejects ambiguous or inactive candidates, and stores every qualified opportunity independently. Public-web verification can never provide literal 100% certainty, so uncertainty is treated as a reason to discard rather than guess.</p>
        </div>
        <div className="standard-stats" aria-label="Prospecting rules">
          <div className="standard-stat"><strong>3+</strong><span>independent sources</span></div>
          <div className="standard-stat"><strong>30d</strong><span>fresh activity target</span></div>
          <div className="standard-stat"><strong>N</strong><span>qualified prospects per day</span></div>
        </div>
      </section>

      <section className="section" aria-labelledby="today-prospect">
        <div className="section-head">
          <div><p className="eyebrow">Today</p><h2 className="section-title" id="today-prospect">Qualified opportunities</h2></div>
          <span className="section-kicker">{data.todayProspects.length} independent {data.todayProspects.length === 1 ? "prospect" : "prospects"}</span>
        </div>

        {!data.persistenceConfigured ? (
          <div className="empty-decision"><div><strong>Persistence required.</strong>Configure DATABASE_URL and run the prospecting migrations before the autonomous commercial loop can persist results.</div></div>
        ) : !data.todayProspects.length ? (
          <div className="empty-decision"><div><strong>No run recorded today.</strong>The daily reconciler will execute an idempotent prospecting iteration when the research and publishing integrations are configured.</div></div>
        ) : (
          <div className="settings-grid">
            {data.todayProspects.map((prospect) => <ProspectCard prospect={prospect} key={prospect.id} />)}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="recent-prospects">
        <div className="section-head"><div><p className="eyebrow">History</p><h2 className="section-title" id="recent-prospects">Recent opportunities</h2></div><span className="section-kicker">No duplicate outreach</span></div>
        <div className="settings-grid">
          {history.length ? history.map((prospect) => (
            <article className="integration-card" key={prospect.id}>
              <h3>{prospect.name}</h3>
              <p>{prospect.runDate.slice(0, 10)} · {scoreLabel(prospect.score)} · {prospect.city || "—"}</p>
              <div className="integration-state"><StatusPill status={prospectStatus(prospect)} label={prospect.status} /></div>
            </article>
          )) : <article className="integration-card"><h3>No earlier history yet</h3><p>Past verified opportunities will appear here.</p></article>}
        </div>
      </section>
    </>
  );
}
