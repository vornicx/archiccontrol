import { updateProspectAction } from "@/app/(control)/prospects/actions";
import { getProspectingData } from "@/prospecting/repository";
import type { ProspectRecord } from "@/prospecting/types";
import { estimateProspectOpportunity } from "@/prospecting/value-estimator";
import styles from "./prospects.module.css";

type JsonRecord = Record<string, unknown>;

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function scoreLabel(score: number | null): string {
  return score == null ? "—" : `${score.toFixed(0)}/100`;
}

const statusLabels: Record<ProspectRecord["status"], string> = {
  researching: "Investigando",
  verified: "Verificado",
  ready: "Listo",
  discarded: "Descartado",
  blocked: "Bloqueado",
};

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

function contactData(prospect: ProspectRecord) {
  const contact = record(prospect.research.contact);
  const person = record(prospect.research.contactPerson ?? prospect.research.decisionMaker ?? prospect.research.askFor);
  return {
    name: text(person.name),
    role: text(person.role) || text(person.title),
    email: text(contact.email),
    phone: text(contact.phone) || text(contact.phone1),
    whatsapp: text(contact.whatsapp),
    address: text(contact.address) || text(contact.addressBusinessListing),
    bestMethod: text(prospect.research.bestContactMethod) || text(contact.bestMethod),
  };
}

function manualPotential(prospect: ProspectRecord): number | null {
  return number(prospect.price.potential);
}

function maintenanceValue(prospect: ProspectRecord): number | null {
  return number(prospect.price.maintenanceMonthly);
}

function ProspectCard({ prospect }: { prospect: ProspectRecord }) {
  const estimate = estimateProspectOpportunity(prospect);
  const potential = manualPotential(prospect);
  const maintenance = maintenanceValue(prospect);
  const contact = contactData(prospect);
  const prototypeUrl = prototypeHref(prospect);
  const downloadUrl = prototypeDownloadHref(prospect);
  const fitReason = String(
    prospect.research.fitReason ||
      prospect.research.whyStrong ||
      prospect.research.summary ||
      prospect.error ||
      "Oportunidad verificada por el motor de prospección.",
  );
  const websiteGap = text(prospect.research.websiteGap) || text(prospect.research.salesAngle);
  const manualNote = text(prospect.research.manualNote);

  return (
    <article className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardHead}>
          <div>
            <p className={styles.cardType}>{prospect.category || "Prospecto"} · {prospect.city || "España"}</p>
            <h3>{prospect.name}</h3>
            <p className={styles.cardIntro}>{fitReason}</p>
          </div>
          <div className={styles.cardSignals}>
            <span className={styles.pill}>Score {scoreLabel(prospect.score)}</span>
            <span className={styles.pill}>Confianza {prospect.verificationConfidence}</span>
            <span className={styles.pill} data-status={prospect.status}>{statusLabels[prospect.status]}</span>
          </div>
        </div>

        <div className={styles.commercialGrid}>
          <div className={styles.commercialBox} data-primary="true">
            <span className={styles.commercialLabel}>Precio potencial · elegido por Archic</span>
            <strong>{potential != null ? money.format(potential) : "Por decidir"}</strong>
            <p>{potential != null ? "Es vuestra referencia comercial manual." : "Abrir Editar prospecto para fijarlo vosotros."}</p>
          </div>
          <div className={styles.commercialBox} data-system="true">
            <span className={styles.commercialLabel}>Estimación Control · automática</span>
            <strong>{money.format(estimate.amount)}</strong>
            <p>Rango orientativo {money.format(estimate.minimum)}–{money.format(estimate.maximum)}</p>
          </div>
          <div className={styles.commercialBox}>
            <span className={styles.commercialLabel}>Mantenimiento</span>
            <strong>{maintenance != null ? `${money.format(maintenance)}/mes` : "—"}</strong>
            <p>Editable junto al precio potencial.</p>
          </div>
        </div>
        <p className={styles.estimateReason}>{estimate.rationale}</p>

        <div className={styles.infoGrid}>
          <section className={styles.infoPanel}>
            <h4>Contacto y siguiente conversación</h4>
            <p><strong>Preguntar por</strong> {contact.name ? `${contact.name}${contact.role ? ` · ${contact.role}` : ""}` : "No verificado"}</p>
            {contact.bestMethod ? <p><strong>Mejor vía</strong> {contact.bestMethod}</p> : null}
            {contact.phone ? <p><strong>Teléfono</strong> <a href={`tel:${contact.phone}`}>{contact.phone}</a></p> : null}
            {contact.whatsapp ? <p><strong>WhatsApp</strong> {contact.whatsapp}</p> : null}
            {contact.email ? <p><strong>Email</strong> <a href={`mailto:${contact.email}`}>{contact.email}</a></p> : null}
            {contact.address ? <p><strong>Dirección</strong> {contact.address}</p> : null}
            {prospect.outreach.message ? <p><strong>Mensaje sugerido</strong> {String(prospect.outreach.message)}</p> : null}
            {manualNote ? <p className={styles.manualNote}><strong>Nota Archic</strong> {manualNote}</p> : null}
          </section>

          <section className={styles.infoPanel}>
            <h4>Brecha, evidencia y prototipo</h4>
            <p><strong>Oportunidad</strong> {websiteGap || "Sin brecha resumida todavía."}</p>
            <div className={styles.resourceActions}>
              {prospect.websiteUrl ? <a className={styles.resourceAction} href={prospect.websiteUrl} target="_blank" rel="noreferrer">Web actual</a> : null}
              {prospect.socialUrl ? <a className={styles.resourceAction} href={prospect.socialUrl} target="_blank" rel="noreferrer">Red social</a> : null}
              {prospect.deploymentUrl ? <a className={styles.resourceAction} href={prospect.deploymentUrl} target="_blank" rel="noreferrer">Prototipo publicado</a> : null}
              {prototypeUrl ? <a className={styles.resourceAction} href={prototypeUrl} target="_blank" rel="noreferrer">Versión exacta</a> : null}
              {prospect.repositoryFullName ? <a className={styles.resourceAction} href={`https://github.com/${prospect.repositoryFullName}`} target="_blank" rel="noreferrer">GitHub</a> : null}
              {downloadUrl ? <a className={styles.resourceAction} href={downloadUrl}>Descargar ZIP</a> : null}
            </div>
            <details className={styles.details}>
              <summary>Ver evidencia ({prospect.evidence.length})</summary>
              <div className={styles.evidence}>
                {prospect.evidence.length ? prospect.evidence.map((item, index) => (
                  <div className={styles.evidenceItem} key={`${item.url}-${index}`}>
                    <a href={item.url} target="_blank" rel="noreferrer">{item.sourceName}</a>
                    <span>{item.detail || item.kind}{item.observedAt ? ` · ${item.observedAt}` : ""}</span>
                  </div>
                )) : <div className={styles.evidenceItem}><span>No hay evidencia guardada.</span></div>}
              </div>
            </details>
          </section>
        </div>
      </div>

      <details className={styles.editor}>
        <summary>Editar prospecto</summary>
        <form action={updateProspectAction} className={styles.editorForm}>
          <input type="hidden" name="prospectId" value={prospect.id} />

          <section className={styles.editorSection}>
            <div className={styles.editorSectionHead}><h4>Negocio</h4><span>La investigación sigue siendo la fuente del score.</span></div>
            <div className={styles.formGrid}>
              <div className={styles.field}><label htmlFor={`${prospect.id}-name`}>Nombre</label><input id={`${prospect.id}-name`} name="name" defaultValue={prospect.name} required /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-status`}>Estado</label><select id={`${prospect.id}-status`} name="status" defaultValue={prospect.status}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-city`}>Ciudad / zona</label><input id={`${prospect.id}-city`} name="city" defaultValue={prospect.city ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-category`}>Categoría</label><input id={`${prospect.id}-category`} name="category" defaultValue={prospect.category ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-web`}>Web</label><input id={`${prospect.id}-web`} name="websiteUrl" type="url" defaultValue={prospect.websiteUrl ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-social`}>Red social</label><input id={`${prospect.id}-social`} name="socialUrl" type="url" defaultValue={prospect.socialUrl ?? ""} /></div>
            </div>
          </section>

          <section className={styles.editorSection}>
            <div className={styles.editorSectionHead}><h4>Decisión comercial</h4><span>Vosotros decidís; Control solo estima.</span></div>
            <div className={styles.formGrid} data-columns="3">
              <div className={styles.field}>
                <label htmlFor={`${prospect.id}-potential`}>Precio potencial</label>
                <input id={`${prospect.id}-potential`} name="potentialPrice" type="number" min="0" step="50" defaultValue={potential ?? ""} placeholder={String(estimate.amount)} />
                <span className={styles.fieldHint}>No modifica la Estimación Control.</span>
              </div>
              <div className={styles.field}>
                <label htmlFor={`${prospect.id}-maintenance`}>Mantenimiento mensual</label>
                <input id={`${prospect.id}-maintenance`} name="maintenanceMonthly" type="number" min="0" step="1" defaultValue={maintenance ?? ""} />
              </div>
              <div className={styles.field}>
                <label>Estimación Control</label>
                <input value={`${money.format(estimate.amount)} · ${money.format(estimate.minimum)}–${money.format(estimate.maximum)}`} readOnly aria-label="Estimación Control" />
                <span className={styles.fieldHint}>Se recalcula con las señales del prospecto.</span>
              </div>
            </div>
          </section>

          <section className={styles.editorSection}>
            <div className={styles.editorSectionHead}><h4>Contacto</h4><span>Corrige aquí cualquier dato público que el motor haya encontrado mal.</span></div>
            <div className={styles.formGrid}>
              <div className={styles.field}><label htmlFor={`${prospect.id}-contact`}>Persona / por quién preguntar</label><input id={`${prospect.id}-contact`} name="contactName" defaultValue={contact.name ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-role`}>Cargo</label><input id={`${prospect.id}-role`} name="contactRole" defaultValue={contact.role ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-phone`}>Teléfono</label><input id={`${prospect.id}-phone`} name="phone" inputMode="tel" defaultValue={contact.phone ?? ""} /></div>
              <div className={styles.field}><label htmlFor={`${prospect.id}-whatsapp`}>WhatsApp</label><input id={`${prospect.id}-whatsapp`} name="whatsapp" inputMode="tel" defaultValue={contact.whatsapp ?? ""} /></div>
              <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor={`${prospect.id}-email`}>Email</label><input id={`${prospect.id}-email`} name="email" type="email" defaultValue={contact.email ?? ""} /></div>
            </div>
          </section>

          <section className={styles.editorSection}>
            <div className={styles.editorSectionHead}><h4>Contexto comercial</h4><span>Lo que queréis recordar al volver a abrir la tarjeta.</span></div>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor={`${prospect.id}-outreach`}>Mensaje de contacto</label><textarea id={`${prospect.id}-outreach`} name="outreachMessage" defaultValue={text(prospect.outreach.message) ?? ""} /></div>
              <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor={`${prospect.id}-note`}>Nota Archic</label><textarea id={`${prospect.id}-note`} name="manualNote" defaultValue={manualNote ?? ""} placeholder="Qué pensamos, precio que tendría sentido, objeciones, cuándo llamar…" /></div>
            </div>
          </section>

          <div className={styles.editorActions}><button className={styles.saveButton} type="submit">Guardar cambios</button></div>
        </form>
      </details>
    </article>
  );
}

export default async function ProspectsPage() {
  const data = await getProspectingData();
  const todayIds = new Set(data.todayProspects.map((prospect) => prospect.id));
  const history = data.recent.filter((prospect) => !todayIds.has(prospect.id));
  const estimates = data.todayProspects.map((prospect) => estimateProspectOpportunity(prospect));
  const totalEstimate = estimates.reduce((sum, estimate) => sum + estimate.amount, 0);
  const selectedPotentials = data.todayProspects.map(manualPotential).filter((value): value is number => value != null);
  const totalPotential = selectedPotentials.reduce((sum, value) => sum + value, 0);
  const scoreValues = data.todayProspects.map((prospect) => prospect.score).filter((value): value is number => value != null);
  const averageScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) : null;

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Motor comercial · Prospección</p>
          <h1 className={styles.title}>Prospección diaria</h1>
          <p className={styles.subtitle}>Control investiga y estima. Vosotros corregís la ficha, elegís el precio potencial y decidís cómo atacar cada oportunidad sin perder la evidencia original.</p>
        </div>
        <aside className={styles.headerPolicy}>
          <strong>Política de selección</strong>
          3+ fuentes independientes · actividad reciente objetivo 30d · 3 flagships objetivo al día.
        </aside>
      </header>

      <section className={styles.metrics} aria-label="Resumen de prospección">
        <div className={styles.metric}><span>Cualificados hoy</span><strong>{data.todayProspects.length}</strong><small>oportunidades independientes</small></div>
        <div className={styles.metric} data-tone="blue"><span>Estimación Control</span><strong>{money.format(totalEstimate)}</strong><small>valor orientativo automático</small></div>
        <div className={styles.metric} data-tone="accent"><span>Potencial elegido</span><strong>{selectedPotentials.length ? money.format(totalPotential) : "—"}</strong><small>{selectedPotentials.length}/{data.todayProspects.length} con precio decidido</small></div>
        <div className={styles.metric}><span>Score medio</span><strong>{averageScore ?? "—"}</strong><small>calidad comercial de la selección</small></div>
      </section>

      <section className={styles.section} aria-labelledby="today-prospect">
        <div className={styles.sectionHead}>
          <div><p className={styles.kicker}>Hoy</p><h2 id="today-prospect">Oportunidades cualificadas</h2><p>Edita la tarjeta sin perder el análisis automático.</p></div>
          <span className={styles.sectionCount}>{data.todayProspects.length} {data.todayProspects.length === 1 ? "prospecto" : "prospectos"}</span>
        </div>

        {!data.persistenceConfigured ? (
          <div className={styles.empty}><strong>Hace falta persistencia.</strong> Configura DATABASE_URL y las migraciones de prospección para guardar y editar resultados.</div>
        ) : !data.todayProspects.length ? (
          <div className={styles.empty}><strong>Hoy todavía no hay una ejecución registrada.</strong> El motor añadirá aquí las oportunidades verificadas del día.</div>
        ) : (
          <div className={styles.cards}>{data.todayProspects.map((prospect) => <ProspectCard prospect={prospect} key={prospect.id} />)}</div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="recent-prospects">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>Historial</p><h2 id="recent-prospects">Oportunidades recientes</h2><p>La referencia manual y la estimación quedan separadas también en el histórico.</p></div><span className={styles.sectionCount}>{history.length} anteriores</span></div>
        {history.length ? (
          <div className={styles.historyGrid}>
            {history.map((prospect) => {
              const estimate = estimateProspectOpportunity(prospect);
              const potential = manualPotential(prospect);
              return (
                <article className={styles.historyCard} key={prospect.id}>
                  <div className={styles.historyTop}><div><h3>{prospect.name}</h3><p>{prospect.runDate.slice(0, 10)} · {prospect.city || "—"} · score {scoreLabel(prospect.score)}</p></div><span className={styles.pill} data-status={prospect.status}>{statusLabels[prospect.status]}</span></div>
                  <div className={styles.historyMoney}>
                    <div><span>Potencial</span><strong>{potential != null ? money.format(potential) : "Por decidir"}</strong></div>
                    <div><span>Control</span><strong>{money.format(estimate.amount)}</strong></div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className={styles.empty}>Todavía no hay historial anterior.</div>}
      </section>
    </div>
  );
}
