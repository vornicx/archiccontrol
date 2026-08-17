import { Topbar } from "@/components/topbar";
import { StatusPill } from "@/components/status-pill";
import { getProspectingData } from "@/prospecting/repository";

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
}

const statusLabels: Record<string, string> = {
  ready: "listo",
  blocked: "bloqueado",
  pending: "pendiente",
  researching: "investigando",
  building: "construyendo",
  published: "publicado",
  rejected: "descartado",
  failed: "fallido",
};

export default async function ProspectsPage() {
  const data = await getProspectingData();
  const today = data.today;
  return (
    <>
      <Topbar eyebrow="Motor comercial" title="Prospección diaria" meta="Un negocio · un prototipo serio" />

      <section className="standard-hero">
        <div>
          <p className="eyebrow">Política de selección</p>
          <h2 className="page-title">Verificar que el negocio está activo antes de invertir tiempo de desarrollo.</h2>
          <p>Control investiga varios negocios, descarta candidatos ambiguos o inactivos y solo utiliza el hueco diario de desarrollo cuando la evidencia pública actual es suficientemente sólida. Si hay dudas importantes, se descarta antes que adivinar.</p>
        </div>
        <div className="standard-stats" aria-label="Reglas de prospección">
          <div className="standard-stat"><strong>3+</strong><span>fuentes independientes</span></div>
          <div className="standard-stat"><strong>30d</strong><span>actividad reciente objetivo</span></div>
          <div className="standard-stat"><strong>1</strong><span>prototipo al día</span></div>
        </div>
      </section>

      <section className="section" aria-labelledby="today-prospect">
        <div className="section-head">
          <div><p className="eyebrow">Hoy</p><h2 className="section-title" id="today-prospect">Oportunidad seleccionada</h2></div>
          <span className="section-kicker">Estado operativo verificado</span>
        </div>

        {!data.persistenceConfigured ? (
          <div className="empty-decision"><div><strong>Hace falta persistencia.</strong> Configura DATABASE_URL y ejecuta la migración 003 para guardar el resultado diario del motor comercial.</div></div>
        ) : !today ? (
          <div className="empty-decision"><div><strong>Hoy todavía no hay una ejecución registrada.</strong> El reconciliador diario ejecutará la prospección cuando estén configuradas las integraciones de investigación y publicación.</div></div>
        ) : (
          <article className="decision-card">
            <span className="decision-type">{today.category || "Prospecto"} · {today.city || "España"}</span>
            <h3>{today.name}</h3>
            <p>{String(today.research.fitReason || today.research.summary || today.error || "Resultado de la prospección diaria")}</p>
            <div className="decision-recommendation">
              <strong>Lectura comercial</strong>
              <p>Puntuación {scoreLabel(today.score)} · Verificación {today.verificationConfidence} · Estado <StatusPill status={today.status === "ready" ? "passed" : today.status === "blocked" ? "failed" : "needs_evidence"} label={statusLabels[today.status] ?? today.status} /></p>
              {today.research.websiteGap ? <p>{String(today.research.websiteGap)}</p> : null}
              {today.price.target ? <p><strong>Objetivo recomendado</strong> €{Number(today.price.target).toLocaleString("es-ES")}{today.price.maintenanceMonthly ? ` + ${Number(today.price.maintenanceMonthly).toLocaleString("es-ES")} €/mes` : ""}</p> : null}
            </div>
            <div className="decision-recommendation">
              <strong>Evidencia</strong>
              {today.evidence.length ? today.evidence.map((item) => (
                <p key={`${item.url}-${item.sourceName}`}><a href={item.url} target="_blank" rel="noreferrer">{item.sourceName}</a> · {item.detail}{item.observedAt ? ` · ${item.observedAt}` : ""}</p>
              )) : <p>No hay un paquete de evidencia guardado.</p>}
            </div>
            <div className="decision-recommendation">
              <strong>Prototipo y entrega</strong>
              <p>
                {today.deploymentUrl ? <><a href={today.deploymentUrl} target="_blank" rel="noreferrer">Abrir prototipo</a>{" · "}</> : null}
                {today.repositoryFullName ? <a href={`https://github.com/${today.repositoryFullName}`} target="_blank" rel="noreferrer">Abrir repositorio de GitHub</a> : null}
                {!today.deploymentUrl && !today.repositoryFullName ? "La publicación todavía no ha terminado." : null}
              </p>
              {today.outreach.message ? <p><strong>Contacto sugerido</strong> {today.outreach.message}</p> : null}
              {today.error ? <p><strong>Bloqueo</strong> {today.error}</p> : null}
            </div>
          </article>
        )}
      </section>

      <section className="section" aria-labelledby="recent-prospects">
        <div className="section-head"><div><p className="eyebrow">Historial</p><h2 className="section-title" id="recent-prospects">Ejecuciones diarias recientes</h2></div><span className="section-kicker">Sin contactos duplicados</span></div>
        <div className="settings-grid">
          {data.recent.length ? data.recent.map((prospect) => (
            <article className="integration-card" key={prospect.id}>
              <h3>{prospect.name}</h3>
              <p>{prospect.runDate} · {scoreLabel(prospect.score)} · {prospect.city || "—"}</p>
              <div className="integration-state"><StatusPill status={prospect.status === "ready" ? "passed" : prospect.status === "blocked" ? "failed" : "needs_evidence"} label={statusLabels[prospect.status] ?? prospect.status} /></div>
            </article>
          )) : <article className="integration-card"><h3>Todavía no hay historial</h3><p>La primera ejecución verificada aparecerá aquí.</p></article>}
        </div>
      </section>
    </>
  );
}
