import { Topbar } from "@/components/topbar";
import { StatusPill } from "@/components/status-pill";
import { getProspectingData } from "@/prospecting/repository";

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
}

export default async function ProspectsPage() {
  const data = await getProspectingData();
  const today = data.today;
  return (
    <>
      <Topbar eyebrow="Commercial engine" title="Daily prospecting" meta="One business · one serious prototype" />

      <section className="standard-hero">
        <div>
          <p className="eyebrow">Selection policy</p>
          <h2 className="page-title">Verified operating status before build spend.</h2>
          <p>Control researches multiple businesses, rejects ambiguous or inactive candidates, and spends the daily build slot only when current public evidence is strong enough. Public-web verification can never provide literal 100% certainty, so uncertainty is treated as a reason to discard rather than guess.</p>
        </div>
        <div className="standard-stats" aria-label="Prospecting rules">
          <div className="standard-stat"><strong>3+</strong><span>independent sources</span></div>
          <div className="standard-stat"><strong>30d</strong><span>fresh activity target</span></div>
          <div className="standard-stat"><strong>1</strong><span>One prototype per day</span></div>
        </div>
      </section>

      <section className="section" aria-labelledby="today-prospect">
        <div className="section-head">
          <div><p className="eyebrow">Today</p><h2 className="section-title" id="today-prospect">Selected opportunity</h2></div>
          <span className="section-kicker">Verified operating status</span>
        </div>

        {!data.persistenceConfigured ? (
          <div className="empty-decision"><div><strong>Persistence required.</strong>Configure DATABASE_URL and run migration 003 before the autonomous commercial loop can persist a daily result.</div></div>
        ) : !today ? (
          <div className="empty-decision"><div><strong>No run recorded today.</strong>The daily reconciler will execute one idempotent prospecting iteration when the research and publishing integrations are configured.</div></div>
        ) : (
          <article className="decision-card">
            <span className="decision-type">{today.category || "Prospect"} · {today.city || "Spain"}</span>
            <h3>{today.name}</h3>
            <p>{String(today.research.fitReason || today.research.summary || today.error || "Daily prospecting result")}</p>
            <div className="decision-recommendation">
              <strong>Commercial read</strong>
              <p>Score {scoreLabel(today.score)} · Verification {today.verificationConfidence} · Status <StatusPill status={today.status === "ready" ? "passed" : today.status === "blocked" ? "failed" : "needs_evidence"} label={today.status} /></p>
              {today.research.websiteGap ? <p>{String(today.research.websiteGap)}</p> : null}
              {today.price.target ? <p><strong>Recommended target</strong>€{Number(today.price.target).toLocaleString("en-US")}{today.price.maintenanceMonthly ? ` + €${Number(today.price.maintenanceMonthly).toLocaleString("en-US")}/month` : ""}</p> : null}
            </div>
            <div className="decision-recommendation">
              <strong>Evidence</strong>
              {today.evidence.length ? today.evidence.map((item) => (
                <p key={`${item.url}-${item.sourceName}`}><a href={item.url} target="_blank" rel="noreferrer">{item.sourceName}</a> · {item.detail}{item.observedAt ? ` · ${item.observedAt}` : ""}</p>
              )) : <p>No evidence bundle stored.</p>}
            </div>
            <div className="decision-recommendation">
              <strong>Prototype & handoff</strong>
              <p>
                {today.deploymentUrl ? <><a href={today.deploymentUrl} target="_blank" rel="noreferrer">Open live prototype</a>{" · "}</> : null}
                {today.repositoryFullName ? <a href={`https://github.com/${today.repositoryFullName}`} target="_blank" rel="noreferrer">Open GitHub repository</a> : null}
                {!today.deploymentUrl && !today.repositoryFullName ? "Publishing has not completed." : null}
              </p>
              {today.outreach.message ? <p><strong>Suggested outreach</strong>{today.outreach.message}</p> : null}
              {today.error ? <p><strong>Blocker</strong>{today.error}</p> : null}
            </div>
          </article>
        )}
      </section>

      <section className="section" aria-labelledby="recent-prospects">
        <div className="section-head"><div><p className="eyebrow">History</p><h2 className="section-title" id="recent-prospects">Recent daily runs</h2></div><span className="section-kicker">No duplicate outreach</span></div>
        <div className="settings-grid">
          {data.recent.length ? data.recent.map((prospect) => (
            <article className="integration-card" key={prospect.id}>
              <h3>{prospect.name}</h3>
              <p>{prospect.runDate} · {scoreLabel(prospect.score)} · {prospect.city || "—"}</p>
              <div className="integration-state"><StatusPill status={prospect.status === "ready" ? "passed" : prospect.status === "blocked" ? "failed" : "needs_evidence"} label={prospect.status} /></div>
            </article>
          )) : <article className="integration-card"><h3>No history yet</h3><p>The first verified run will appear here.</p></article>}
        </div>
      </section>
    </>
  );
}
