import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addContactAction,
  deleteContactAction,
  recordOutcomeAction,
  setPrimaryContactAction,
  updateContactAction,
  updateStageAction,
} from "@/app/sales/actions";
import {
  getSalesActivities,
  getSalesContacts,
  getSalesLead,
  getSalesPipelineStages,
} from "@/sales/repository";
import { salesOutcomeLabels, salesOutcomes, salesStageLabels } from "@/sales/types";
import styles from "./lead-detail.module.css";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const timestamp = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const activityLabels: Record<string, string> = {
  call: "Llamada",
  message: "Mensaje",
  email: "Correo",
  note: "Nota",
  stage_change: "Cambio de etapa",
};

function whatsappHref(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function SalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, persistenceConfigured }, activities, contacts, stages] = await Promise.all([
    getSalesLead(id),
    getSalesActivities(id),
    getSalesContacts(id),
    getSalesPipelineStages(),
  ]);
  if (!lead) notFound();

  const stageLabels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const activeStages = stages.filter((stage) => stage.active || stage.key === lead.stage);
  const primaryWhatsapp = whatsappHref(lead.phone);

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">{lead.city || "Oportunidad"} · {lead.category || "Negocio"}</p>
          <h1 className="sales-title">{lead.name}</h1>
          <p className="sales-subtitle">
            <span className="sales-badge" data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? salesStageLabels[lead.stage]}</span>
            {lead.source ? ` · ${lead.source}` : ""}
            {lead.score != null ? ` · Puntuación ${lead.score}/100` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/sales/leads/${lead.id}/edit`} className="sales-button">Editar ficha</Link>
          <Link href="/sales/pipeline" className="sales-button secondary">Volver al pipeline</Link>
        </div>
      </header>

      {!persistenceConfigured ? (
        <div className="sales-alert"><strong>Modo de prueba.</strong> La ficha se puede revisar; para guardar cambios hay que aplicar las migraciones de Ventas.</div>
      ) : null}

      <div className="sales-detail-grid">
        <div>
          <section className="sales-panel">
            <h2>Siguiente movimiento</h2>
            <p className="sales-note">{lead.nextAction || "No hay una siguiente acción definida."}</p>
            <div className="sales-actions">
              {lead.phone ? <a className="sales-button" href={`tel:${lead.phone}`}>Llamar</a> : null}
              {primaryWhatsapp ? <a className="sales-button secondary" href={primaryWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
              {lead.email ? <a className="sales-button secondary" href={`mailto:${lead.email}`}>Correo</a> : null}
              {lead.prototypeUrl ? <a className="sales-button secondary" href={lead.prototypeUrl} target="_blank" rel="noreferrer">Abrir prototipo</a> : null}
            </div>
            <div className={styles.moneyGrid} aria-label="Economía de la oportunidad">
              <div className={styles.moneyItem}><span>Potencial</span><strong>{lead.estimatedValue != null ? money.format(lead.estimatedValue) : "—"}</strong></div>
              <div className={styles.moneyItem}><span>Precio enviado</span><strong>{lead.quotedPrice != null ? money.format(lead.quotedPrice) : "—"}</strong></div>
              <div className={styles.moneyItem}><span>Recurrente</span><strong>{lead.maintenanceMonthly != null ? `${money.format(lead.maintenanceMonthly)}/mes` : "—"}</strong></div>
            </div>
          </section>

          <section className="sales-panel">
            <h2>Pipeline</h2>
            <p className="sales-subtitle">Mover de etapa actualiza el pipeline y deja registro en el historial.</p>
            <form action={updateStageAction} className={styles.stageForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="stage" defaultValue={lead.stage} disabled={!persistenceConfigured}>
                {activeStages.map((stage) => <option value={stage.key} key={stage.key}>{stage.label} · {stage.probability}%</option>)}
              </select>
              <button type="submit" disabled={!persistenceConfigured}>Cambiar etapa</button>
            </form>
          </section>

          <section className="sales-panel">
            <h2>Contexto</h2>
            <p className="sales-note">{lead.notes || "Sin notas todavía."}</p>
            <div className="sales-facts">
              <div className="sales-fact"><span>Responsable</span><strong>{lead.owner === "antero" ? "Antero" : "Vadim"}</strong></div>
              <div className="sales-fact"><span>Próxima acción</span><strong>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"}</strong></div>
              <div className="sales-fact"><span>Contacto principal</span><strong>{lead.contactName || "Sin identificar"}</strong></div>
              <div className="sales-fact"><span>Último contacto</span><strong>{lead.lastContactAt ? timestamp.format(new Date(lead.lastContactAt)) : "Aún no"}</strong></div>
              {lead.websiteUrl ? <div className="sales-fact"><span>Web</span><a href={lead.websiteUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}
              {lead.socialUrl ? <div className="sales-fact"><span>Social</span><a href={lead.socialUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}
              {lead.repositoryFullName ? <div className="sales-fact"><span>Repositorio</span><a href={`https://github.com/${lead.repositoryFullName}`} target="_blank" rel="noreferrer">{lead.repositoryFullName}</a></div> : null}
            </div>
          </section>

          <section className="sales-panel">
            <h2>Contactos</h2>
            <div className={styles.contacts}>
              {contacts.map((contact) => {
                const whatsapp = whatsappHref(contact.whatsapp || contact.phone);
                return (
                  <article className={styles.contactCard} key={contact.id}>
                    <div>
                      <div className={styles.contactMeta}>
                        <h3>{contact.name}</h3>
                        {contact.isPrimary ? <span className={styles.primary}>Principal</span> : null}
                      </div>
                      <p>{contact.role || "Cargo sin especificar"}{contact.notes ? ` · ${contact.notes}` : ""}</p>
                      <div className={styles.contactMethods}>
                        {contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : null}
                        {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                        {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
                      </div>
                    </div>
                    <div className={styles.contactActions}>
                      {!contact.isPrimary ? (
                        <form action={setPrimaryContactAction}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <input type="hidden" name="contactId" value={contact.id} />
                          <button className={styles.contactAction} type="submit" disabled={!persistenceConfigured}>Hacer principal</button>
                        </form>
                      ) : null}
                      <form action={deleteContactAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button className={`${styles.contactAction} ${styles.danger}`} type="submit" disabled={!persistenceConfigured}>Eliminar</button>
                      </form>
                    </div>
                    <details className={styles.editDetails}>
                      <summary>Editar contacto</summary>
                      <form action={updateContactAction} className={styles.contactForm}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <input type="hidden" name="wasPrimary" value={String(contact.isPrimary)} />
                        <input name="name" defaultValue={contact.name} placeholder="Nombre" required disabled={!persistenceConfigured} />
                        <input name="role" defaultValue={contact.role ?? ""} placeholder="Cargo / por quién preguntar" disabled={!persistenceConfigured} />
                        <input name="phone" defaultValue={contact.phone ?? ""} inputMode="tel" placeholder="Teléfono" disabled={!persistenceConfigured} />
                        <input name="whatsapp" defaultValue={contact.whatsapp ?? ""} inputMode="tel" placeholder="WhatsApp" disabled={!persistenceConfigured} />
                        <input className={styles.full} name="email" defaultValue={contact.email ?? ""} type="email" placeholder="Correo" disabled={!persistenceConfigured} />
                        <textarea className={styles.full} name="notes" defaultValue={contact.notes ?? ""} placeholder="Notas sobre esta persona" disabled={!persistenceConfigured} />
                        <label className={`${styles.checkbox} ${styles.full}`}><input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} disabled={!persistenceConfigured} /> Contacto principal</label>
                        <button className={`sales-button ${styles.full}`} type="submit" disabled={!persistenceConfigured}>Guardar contacto</button>
                      </form>
                    </details>
                  </article>
                );
              })}
              {!contacts.length ? <p className="sales-subtitle">Todavía no hay personas de contacto guardadas.</p> : null}
            </div>

            <form action={addContactAction} className={styles.contactForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input name="name" placeholder="Nombre" required disabled={!persistenceConfigured} />
              <input name="role" placeholder="Cargo / por quién preguntar" disabled={!persistenceConfigured} />
              <input name="phone" inputMode="tel" placeholder="Teléfono" disabled={!persistenceConfigured} />
              <input name="whatsapp" inputMode="tel" placeholder="WhatsApp" disabled={!persistenceConfigured} />
              <input className={styles.full} name="email" type="email" placeholder="Correo" disabled={!persistenceConfigured} />
              <textarea className={styles.full} name="notes" placeholder="Notas sobre esta persona" disabled={!persistenceConfigured} />
              <label className={`${styles.checkbox} ${styles.full}`}><input type="checkbox" name="isPrimary" disabled={!persistenceConfigured} /> Usar como contacto principal</label>
              <button className={`sales-button ${styles.full}`} type="submit" disabled={!persistenceConfigured}>Añadir contacto</button>
            </form>
          </section>

          <section className="sales-panel">
            <h2>Historial</h2>
            <div className="sales-timeline">
              {activities.map((activity) => (
                <article className="sales-activity" key={activity.id}>
                  <time>{timestamp.format(new Date(activity.createdAt))}</time>
                  <div><strong>{activity.outcome ? salesOutcomeLabels[activity.outcome] : activityLabels[activity.type] ?? activity.type}</strong><p>{activity.note || `Registrado por ${activity.actor}`}</p></div>
                </article>
              ))}
              {!activities.length ? <p className="sales-subtitle">Aún no hay actividad registrada.</p> : null}
            </div>
          </section>
        </div>

        <aside>
          <section className="sales-panel">
            <h2>Resultado de llamada</h2>
            <form action={recordOutcomeAction} className="sales-outcome-form">
              <input type="hidden" name="leadId" value={lead.id} />
              <textarea name="note" placeholder="Qué dijo, qué necesita, cuándo volver a hablar…" disabled={!persistenceConfigured} />
              <div className="sales-outcome-grid">
                {salesOutcomes.map((outcome) => <button key={outcome} name="outcome" value={outcome} disabled={!persistenceConfigured}>{salesOutcomeLabels[outcome]}</button>)}
              </div>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
