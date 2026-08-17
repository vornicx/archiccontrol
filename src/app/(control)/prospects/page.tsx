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
  return Number.isFinite(amount) && amount >= 0 ? `${amount.toLocaleString("es-ES")} €` : null;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const statusLabels: Record<string, string> = {
  researching: "investigando",
  verified: "verificado",
  ready: "listo",
  discarded: "descartado",
  blocked: "bloqueado",
};

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
    phone: "Teléfono",
    phone1: "Teléfono",
    phone2: "Teléfono 2",
    phoneWeb: "Teléfono web",
    phoneBusinessListing: "Teléfono ficha pública",
    whatsapp: "WhatsApp",
    address: "Dirección",
    addressBusinessListing: "Dirección ficha pública",
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
  return "No verificado";
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
      "Oportunidad verificada por el motor de prospección",
  );
  const websiteGap = prospect.research.websiteGap || prospect.research.salesAngle;

  return (
    <article className="decision-card">
      <span className="decision-type">{prospect.category || "Prospecto"} · {prospect.city || "España"}</span>
      <h3>{prospect.name}</h3>
      <p>{fitReason}</p>
      <div className="decision-recommendation">
        <strong>Lectura comercial</strong>
        <p>
          Puntuación {scoreLabel(prospect.score)} · Verificación {prospect.verificationConfidence} · Estado{" "}
          <StatusPill status={prospectStatus(prospect)} label={statusLabels[prospect.status] ?? prospect.status} />
        </p>
        {websiteGap ? <p>{String(websiteGap)}</p> : null}
        {prospect.price.target ? (
          <p>
            <strong>Objetivo recomendado</strong> {Number(prospect.price.target).toLocaleString("es-ES")} €
            {prospect.price.maintenanceMonthly ? ` + ${Number(prospect.price.maintenanceMonthly).toLocaleString("es-ES")} €/mes` : ""}
          </p>
        ) : null}
        <p>
          <strong>Valor estimado de la oportunidad</strong> {opportunityValue.amount || "Todavía sin estimar"}
          {opportunityValue.rationale ? ` · ${opportunityValue.rationale}` : ""}
        </p>
      </div>
      <div className="decision-recommendation">
        <strong>Contacto y decisor</strong>
        <p><strong>Preguntar por</strong> {askFor}</p>
        {preferredContact ? <p><strong>Mejor vía de contacto</strong> {preferredContact}</p> : null}
        {contacts.length ? contacts.map((item, index) => (
          <p key={`${item.label}-${item.value}-${index}`}><strong>{item.label}</strong> {item.value}</p>
        )) : <p>Todavía no hay un contacto público verificado guardado.</p>}
      </div>
      <div className="decision-recommendation">
        <strong>Evidencia</strong>
        {prospect.evidence.length ? prospect.evidence.map((item, index) => (
          <p key={`${item.url}-${item.sourceName}-${index}`}>
            <a href={item.url} target="_blank" rel="noreferrer">{item.sourceName}</a>
            {item.detail ? ` · ${item.detail}` : ""}{item.observedAt ? ` · ${item.observedAt}` : ""}
          </p>
        )) : <p>No hay un paquete de evidencia guardado.</p>}
      </div>
      <div className="decision-recommendation">
        <strong>Prototipo y entrega</strong>
        <p>
          {prospect.deploymentUrl ? <><a href={prospect.deploymentUrl} target="_blank" rel="noreferrer">Abrir prototipo publicado</a>{" · "}</> : null}
          {prototypeUrl ? <><a href={prototypeUrl} target="_blank" rel="noreferrer">Abrir versión exacta del prototipo</a>{" · "}</> : null}
          {prospect.repositoryFullName ? <a href={`https://github.com/${prospect.repositoryFullName}`} target="_blank" rel="noreferrer">Abrir repositorio de GitHub</a> : null}
          {!prospect.deploymentUrl && !prototypeUrl && !prospect.repositoryFullName ? "La publicación todavía no ha terminado." : null}
        </p>
        {downloadUrl ? (
          <div className="prospect-actions">
            <a className="button button-primary" href={downloadUrl}>Descargar prototipo</a>
          </div>
        ) : <p>La descarga aparecerá cuando exista un commit o artefacto exacto guardado.</p>}
        {prospect.outreach.message ? <p><strong>Contacto sugerido</strong> {prospect.outreach.message}</p> : null}
        {prospect.error ? <p><strong>Bloqueo</strong> {prospect.error}</p> : null}
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
      <Topbar eyebrow="Motor comercial" title="Prospección diaria" meta="Oportunidades independientes · aprobación antes de contactar" />

      <section className="standard-hero">
        <div>
          <p className="eyebrow">Política de selección</p>
          <h2 className="page-title">Verificar que el negocio está activo antes de invertir tiempo de desarrollo.</h2>
          <p>Control investiga varios negocios, descarta candidatos ambiguos o inactivos y guarda cada oportunidad cualificada de forma independiente. Si la evidencia pública deja dudas importantes, se descarta antes que adivinar.</p>
        </div>
        <div className="standard-stats" aria-label="Reglas de prospección">
          <div className="standard-stat"><strong>3+</strong><span>fuentes independientes</span></div>
          <div className="standard-stat"><strong>30d</strong><span>actividad reciente objetivo</span></div>
          <div className="standard-stat"><strong>3</strong><span>flagships objetivo al día</span></div>
        </div>
      </section>

      <section className="section" aria-labelledby="today-prospect">
        <div className="section-head">
          <div><p className="eyebrow">Hoy</p><h2 className="section-title" id="today-prospect">Oportunidades cualificadas</h2></div>
          <span className="section-kicker">{data.todayProspects.length} {data.todayProspects.length === 1 ? "prospecto independiente" : "prospectos independientes"}</span>
        </div>

        {!data.persistenceConfigured ? (
          <div className="empty-decision"><div><strong>Hace falta persistencia.</strong> Configura DATABASE_URL y ejecuta las migraciones de prospección antes de guardar resultados del motor comercial.</div></div>
        ) : !data.todayProspects.length ? (
          <div className="empty-decision"><div><strong>Hoy todavía no hay una ejecución registrada.</strong> El reconciliador diario ejecutará la prospección cuando estén configuradas las integraciones de investigación y publicación.</div></div>
        ) : (
          <div className="settings-grid">
            {data.todayProspects.map((prospect) => <ProspectCard prospect={prospect} key={prospect.id} />)}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="recent-prospects">
        <div className="section-head"><div><p className="eyebrow">Historial</p><h2 className="section-title" id="recent-prospects">Oportunidades recientes</h2></div><span className="section-kicker">Sin contactos duplicados</span></div>
        <div className="settings-grid">
          {history.length ? history.map((prospect) => (
            <article className="integration-card" key={prospect.id}>
              <h3>{prospect.name}</h3>
              <p>{prospect.runDate.slice(0, 10)} · {scoreLabel(prospect.score)} · {prospect.city || "—"}</p>
              <div className="integration-state"><StatusPill status={prospectStatus(prospect)} label={statusLabels[prospect.status] ?? prospect.status} /></div>
            </article>
          )) : <article className="integration-card"><h3>Todavía no hay historial anterior</h3><p>Las oportunidades verificadas anteriores aparecerán aquí.</p></article>}
        </div>
      </section>
    </>
  );
}
