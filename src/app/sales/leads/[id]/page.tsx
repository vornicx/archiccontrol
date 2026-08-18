import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addContactAction,
  deleteContactAction,
  recordActivityAction,
  recordOutcomeAction,
  setPrimaryContactAction,
  updateContactAction,
  updateNextActionAction,
  updateStageAction,
} from "@/app/sales/actions";
import { DateTimePicker } from "@/components/date-time-picker";
import { salesOperationsConfigured } from "@/sales/operations-readiness";
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

function madridInputValue(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export default async function SalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, persistenceConfigured }, activities, contacts, stages, operationsConfigured] = await Promise.all([
    getSalesLead(id),
    getSalesActivities(id),
    getSalesContacts(id),
    getSalesPipelineStages(),
    salesOperationsConfigured(),
  ]);
  if (!lead) notFound();

  const stageLabels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const activeStages = stages.filter((stage) => stage.active || stage.key === lead.stage);
  const primaryWhatsapp = whatsappHref(lead.phone);
  const commercialValue = lead.quotedPrice ?? lead.estimatedValue;

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · {lead.city || "Oportunidad"} · {lead.category || "Negocio"}</p>
          <h1 className="sales-title">{lead.name}</h1>
          <p className="sales-subtitle">
            <span className="sales-badge" data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? salesStageLabels[lead.stage]}</span>
            {lead.source ? ` · ${lead.source}` : ""}
            {lead.score != null ? ` · Puntuación ${lead.score}/100` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/sales/leads/${lead.id}/edit`} className="sales-button">Editar ficha</Link>
          <Link href="/sales/opportunities" className="sales-button secondary">Volver a oportunidades</Link>
        </div>
      </header>

      {!persistenceConfigured ? (
        <div className="sales-alert"><strong>Modo de prueba.</strong> La ficha se puede revisar; guardar actividad requiere persistencia comercial.</div>
      ) : !operationsConfigured ? (
        <div className="sales-alert"><strong>CRM pendiente de migración.</strong> Actividad, llamadas y siguientes acciones siguen disponibles, pero contactos múltiples y pricing ampliado requieren la migración 006.</div>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Resumen de oportunidad">
        <div className={styles.summaryItem} data-emphasis="true"><span>Valor comercial</span><strong>{commercialValue != null ? money.format(commercialValue) : "—"}</strong></div>
        <div className={styles.summaryItem}><span>Oferta enviada</span><strong>{lead.quotedPrice != null ? money.format(lead.quotedPrice) : "Sin oferta"}</strong></div>
        <div className={styles.summaryItem}><span>Recurrente</span><strong>{lead.maintenanceMonthly != null ? `${money.format(lead.maintenanceMonthly)}/mes` : "—"}</strong></div>
        <div className={styles.summaryItem}><span>Responsable</span><strong>{lead.owner === "antero" ? "Antero" : "Vadim"}</strong></div>
        <div className={styles.summaryItem}><span>Siguiente acción</span><strong>{lead.nextActionAt ? timestamp.format(new Date(lead.nextActionAt)) : "Sin fecha"}</strong></div>
      </section>

      <div className="sales-detail-grid">
        <div>
          <section className="sales-panel">
            <div className={styles.timelineHead}><h2>Actividad</h2><span>{activities.length} registros recientes</span></div>
            <div className="sales-timeline">
              {activities.map((activity) => (
                <article className="sales-activity" key={activity.id}>
                  <time>{timestamp.format(new Date(activity.createdAt))}</time>
                  <div>
                    <strong>{activity.outcome ? salesOutcomeLabels[activity.outcome] : activityLabels[activity.type] ?? activity.type}</strong>
                    <p>{activity.note || `Registrado por ${activity.actor}`}</p>
                  </div>
                </article>
              ))}
              {!activities.length ? <p className="sales-subtitle">Aún no hay actividad registrada. Añade la primera desde la columna derecha.</p> : null}
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
                          <button className={styles.contactAction} type="submit" disabled={!operationsConfigured}>Hacer principal</button>
                        </form>
                      ) : null}
                      <form action={deleteContactAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button className={`${styles.contactAction} ${styles.danger}`} type="submit" disabled={!operationsConfigured}>Eliminar</button>
                      </form>
                    </div>
                    <details className={styles.editDetails}>
                      <summary>Editar contacto</summary>
                      <form action={updateContactAction} className={styles.contactForm}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <input type="hidden" name="wasPrimary" value={String(contact.isPrimary)} />
                        <input name="name" defaultValue={contact.name} placeholder="Nombre" required disabled={!operationsConfigured} />
                        <input name="role" defaultValue={contact.role ?? ""} placeholder="Cargo / por quién preguntar" disabled={!operationsConfigured} />
                        <input name="phone" defaultValue={contact.phone ?? ""} inputMode="tel" placeholder="Teléfono" disabled={!operationsConfigured} />
                        <input name="whatsapp" defaultValue={contact.whatsapp ?? ""} inputMode="tel" placeholder="WhatsApp" disabled={!operationsConfigured} />
                        <input className={styles.full} name="email" defaultValue={contact.email ?? ""} type="email" placeholder="Correo" disabled={!operationsConfigured} />
                        <textarea className={styles.full} name="notes" defaultValue={contact.notes ?? ""} placeholder="Notas sobre esta persona" disabled={!operationsConfigured} />
                        <label className={`${styles.checkbox} ${styles.full}`}><input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} disabled={!operationsConfigured} /> Contacto principal</label>
                        <button className={`sales-button ${styles.full}`} type="submit" disabled={!operationsConfigured}>Guardar contacto</button>
                      </form>
                    </details>
                  </article>
                );
              })}
              {!contacts.length ? <p className="sales-subtitle">Todavía no hay personas de contacto guardadas.</p> : null}
            </div>

            <form action={addContactAction} className={styles.contactForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input name="name" placeholder="Nombre" required disabled={!operationsConfigured} />
              <input name="role" placeholder="Cargo / por quién preguntar" disabled={!operationsConfigured} />
              <input name="phone" inputMode="tel" placeholder="Teléfono" disabled={!operationsConfigured} />
              <input name="whatsapp" inputMode="tel" placeholder="WhatsApp" disabled={!operationsConfigured} />
              <input className={styles.full} name="email" type="email" placeholder="Correo" disabled={!operationsConfigured} />
              <textarea className={styles.full} name="notes" placeholder="Notas sobre esta persona" disabled={!operationsConfigured} />
              <label className={`${styles.checkbox} ${styles.full}`}><input type="checkbox" name="isPrimary" disabled={!operationsConfigured} /> Usar como contacto principal</label>
              <button className={`sales-button ${styles.full}`} type="submit" disabled={!operationsConfigured}>Añadir contacto</button>
            </form>
          </section>

          <section className="sales-panel">
            <h2>Contexto de la oportunidad</h2>
            <p className="sales-note">{lead.notes || "Sin notas todavía."}</p>
            <div className="sales-facts">
              <div className="sales-fact"><span>Contacto principal</span><strong>{lead.contactName || "Sin identificar"}</strong></div>
              <div className="sales-fact"><span>Último contacto</span><strong>{lead.lastContactAt ? timestamp.format(new Date(lead.lastContactAt)) : "Aún no"}</strong></div>
              <div className="sales-fact"><span>Origen</span><strong>{lead.source || "Sin origen"}</strong></div>
              <div className="sales-fact"><span>Potencial</span><strong>{lead.estimatedValue != null ? money.format(lead.estimatedValue) : "—"}</strong></div>
              {lead.websiteUrl ? <div className="sales-fact"><span>Web</span><a href={lead.websiteUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}
              {lead.socialUrl ? <div className="sales-fact"><span>Social</span><a href={lead.socialUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}
              {lead.prototypeUrl ? <div className="sales-fact"><span>Prototipo</span><a href={lead.prototypeUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}
              {lead.repositoryFullName ? <div className="sales-fact"><span>Repositorio</span><a href={`https://github.com/${lead.repositoryFullName}`} target="_blank" rel="noreferrer">{lead.repositoryFullName}</a></div> : null}
            </div>
          </section>
        </div>

        <aside className={styles.asideStack}>
          <section className={styles.asidePanel}>
            <h2>Siguiente acción</h2>
            <p>El CRM debe dejar claro qué ocurre después, quién lo hace y cuándo.</p>
            <form action={updateNextActionAction} className={styles.quickForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <textarea name="nextAction" defaultValue={lead.nextAction ?? ""} placeholder="Ej. llamar, enviar propuesta, preparar demo…" disabled={!persistenceConfigured} />
              <select name="nextActionOwner" defaultValue={lead.nextActionOwner} disabled={!persistenceConfigured} aria-label="Responsable de siguiente acción">
                <option value="antero">Antero</option><option value="vadim">Vadim</option>
              </select>
              <DateTimePicker name="nextActionAt" initialValue={madridInputValue(lead.nextActionAt)} disabled={!persistenceConfigured} />
              <select name="actor" defaultValue={lead.nextActionOwner} disabled={!persistenceConfigured} aria-label="Quién actualiza la acción">
                <option value="antero">Actualizado por Antero</option><option value="vadim">Actualizado por Vadim</option>
              </select>
              <button type="submit" disabled={!persistenceConfigured}>Guardar siguiente acción</button>
            </form>
            <div className={styles.quickLinks}>
              {lead.phone ? <a href={`tel:${lead.phone}`}>Llamar</a> : <span />}
              {primaryWhatsapp ? <a href={primaryWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : <span />}
              {lead.email ? <a href={`mailto:${lead.email}`}>Correo</a> : <span />}
            </div>
          </section>

          <section className={styles.asidePanel}>
            <h2>Etapa</h2>
            <p>Mover de etapa actualiza el pipeline y deja trazabilidad.</p>
            <form action={updateStageAction} className={styles.stageForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="stage" defaultValue={lead.stage} disabled={!persistenceConfigured}>
                {activeStages.map((stage) => <option value={stage.key} key={stage.key}>{stage.label} · {stage.probability}%</option>)}
              </select>
              <button type="submit" disabled={!persistenceConfigured}>Mover</button>
            </form>
          </section>

          <section className={styles.asidePanel}>
            <h2>Registrar actividad</h2>
            <p>Añade contexto sin alterar automáticamente la etapa ni la siguiente acción.</p>
            <form action={recordActivityAction} className={styles.activityForm}>
              <input type="hidden" name="leadId" value={lead.id} />
              <div className={styles.activityRow}>
                <select name="type" defaultValue="note" disabled={!persistenceConfigured} aria-label="Tipo de actividad">
                  <option value="note">Nota</option><option value="call">Llamada</option><option value="message">Mensaje / WhatsApp</option><option value="email">Correo</option>
                </select>
                <select name="actor" defaultValue="vadim" disabled={!persistenceConfigured} aria-label="Autor de actividad">
                  <option value="vadim">Vadim</option><option value="antero">Antero</option>
                </select>
              </div>
              <textarea name="note" required placeholder="Qué pasó, qué dijo el cliente, qué aprendimos…" disabled={!persistenceConfigured} />
              <button type="submit" disabled={!persistenceConfigured}>Añadir al historial</button>
            </form>
          </section>

          <section className={styles.asidePanel}>
            <h2>Resultado de llamada</h2>
            <p>Úsalo cuando quieras que Control actualice automáticamente etapa y seguimiento.</p>
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
