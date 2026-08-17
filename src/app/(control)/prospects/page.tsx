import { Topbar } from "@/components/topbar";
import { StatusPill } from "@/components/status-pill";
import { getProspectingData } from "@/prospecting/repository";
import type { ProspectRecord } from "@/prospecting/types";

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
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

function prototypeHref(prospect: ProspectRecord): string | null {
  const prototype = prospect.research.prototype as { repository?: unknown; branch?: unknown; commit?: unknown; path?: unknown } | undefined;
  const ref = prototype?.commit || prototype?.branch;
  if (!prototype?.repository || !ref || !prototype.path) return null;
  return `https://github.com/${String(prototype.repository)}/blob/${String(ref)}/${String(prototype.path)}`;
}

function ProspectCard({ prospect }: { prospect: ProspectRecord }) {
  const prototypeUrl = prototypeHref(prospect);
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
            <strong>Objetivo recomendado</strong> €{Number(prospect.price.target).toLocaleString("es-ES")}
            {prospect.price.maintenanceMonthly ? ` + ${Number(prospect.price.maintenanceMonthly).toLocaleString("es-ES")} €/mes` : ""}
          </p>
        ) : null}
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
          <div className="standard-stat"><strong>N</strong><span>prospectos cualificados al día</span></div>
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
