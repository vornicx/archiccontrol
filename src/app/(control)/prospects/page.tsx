import { Topbar } from "@/components/topbar";
import { StatusPill } from "@/components/status-pill";
import { getProspectingData } from "@/prospecting/repository";
import type { ProspectRecord } from "@/prospecting/types";

type JsonRecord = Record<string, unknown>;

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
}

function moneyLabel(value: unknown): string | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? `€${amount.toLocaleString("en-US")}` : null;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function prospectStatus(prospect: ProspectRecord): "passed" | "failed" | "needs_evidence" {
  return prospect.status === "ready" ? "passed" : prospect.status === "blocked" ? "failed" : "needs_evidence";
}

function prototypeMetadata(prospect: ProspectRecord) {
  const prototype = record(prospect.research.prototype);
  return {
    repository: text(prototype.repository),
    branch: text(prototype.branch),
    commit: text(prototype.commit),
    path: text(prototype.path),
    downloadUrl: text(prototype.downloadUrl),
  };
}

function prototypeHref(prospect: ProspectRecord): string | null {
  const prototype = prototypeMetadata(prospect);
  const ref = prototype.commit || prototype.branch;
  if (!prototype.repository || !ref || !prototype.path) return null;
  return `https://github.com/${prototype.repository}/blob/${ref}/${prototype.path}`;
}

function prototypeDownloadHref(prospect: ProspectRecord): string | null {
  const prototype = prototypeMetadata(prospect);
  const repository = prototype.repository || prospect.repositoryFullName;
  if (!prototype.downloadUrl && (!repository || !prototype.commit)) return null;
  return `/api/prospects/prototype-download?prospectId=${encodeURIComponent(prospect.id)}`;
}

function contactLines(prospect: ProspectRecord): Array<{ label: string; value: string }> {
  const contact = record(prospect.research.contact);
  const labels: Record<string, string> = {
    email: "Email",
    phone: "Phone",
    phone1: "Phone",
    phone2: "Phone 2",
    phoneWeb: "Website phone",
    phoneBusinessListing: "Listing phone",
    whatsapp: "WhatsApp",
    address: "Address",
    addressBusinessListing: "Listing address",
  };
  const preferred = Object.keys(labels);
  const seen = new Set<string>();
  const output: Array<{ label: string; value: string }> = [];

  for (const key of [...preferred, ...Object.keys(contact)]) {
    if (seen.has(key) || key === "bestMethod") continue;
    seen.add(key);
    const value = text(contact[key]);
    if (!value) continue;
    output.push({
      label: labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()),
      value,
    });
  }

  return output;
}

function contactPersonLabel(prospect: ProspectRecord): string {
  const raw = prospect.research.contactPerson ?? prospect.research.decisionMaker ?? prospect.research.askFor;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const person = record(raw);
  const name = text(person.name);
  const role = text(person.role) || text(person.title);
  if (name) return role ? `${name} · ${role}` : name;
  return "Not verified";
}

function bestContactMethod(prospect: ProspectRecord): string | null {
  const contact = record(prospect.research.contact);
  return text(prospect.research.bestContactMethod) || text(contact.bestMethod);
}

function estimatedValue(prospect: ProspectRecord): { amount: string | null; rationale: string | null } {
  const raw = prospect.research.estimatedValue ?? prospect.research.estimatedOpportunityValue;
  if (typeof raw === "number") return { amount: moneyLabel(raw), rationale: null };
  const value = record(raw);
  return {
    amount: moneyLabel(value.amount ?? value.value),
    rationale: text(value.rationale),
  };
}

function ProspectCard({ prospect }: { prospect: ProspectRecord }) {
  const prototypeUrl = prototypeHref(prospect);
  const downloadUrl = prototypeDownloadHref(prospect);
  const contacts = contactLines(prospect);
  const askFor = contactPersonLabel(prospect);
  const preferredContact = bestContactMethod(prospect);
  const opportunityValue = estimatedValue(prospect);
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
        <p>
          <strong>Estimated opportunity value</strong>{opportunityValue.amount || "Not estimated yet"}
          {opportunityValue.rationale ? ` · ${opportunityValue.rationale}` : ""}
        </p>
      </div>
      <div className="decision-recommendation">
        <strong>Contact & decision-maker</strong>
        <p><strong>Ask for</strong>{askFor}</p>
        {preferredContact ? <p><strong>Best contact route</strong>{preferredContact}</p> : null}
        {contacts.length ? contacts.map((item, index) => (
          <p key={`${item.label}-${item.value}-${index}`}><strong>{item.label}</strong>{item.value}</p>
        )) : <p>No verified public contact stored yet.</p>}
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
        {downloadUrl ? (
          <div className="prospect-actions">
            <a className="button button-primary" href={downloadUrl}>Download prototype</a>
          </div>
        ) : <p>Download will appear when an exact commit/artifact is stored.</p>}
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
