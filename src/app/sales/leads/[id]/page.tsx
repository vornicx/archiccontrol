import Link from "next/link";
import { notFound } from "next/navigation";
import { recordOutcomeAction } from "@/app/sales/actions";
import { getSalesActivities, getSalesLead } from "@/sales/repository";
import { salesOutcomeLabels, salesOutcomes, salesStageLabels } from "@/sales/types";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const timestamp = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const activityLabels: Record<string, string> = {
  call: "Llamada",
  message: "Mensaje",
  email: "Correo",
  note: "Nota",
  stage_change: "Cambio de etapa",
};

export default async function SalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lead, persistenceConfigured } = await getSalesLead(id);
  if (!lead) notFound();
  const activities = await getSalesActivities(id);
  const whatsapp = lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g,"")}` : null;
  return <><header className="sales-header"><div><p className="sales-eyebrow">{lead.city || "Oportunidad"} · {lead.category || "Negocio"}</p><h1 className="sales-title">{lead.name}</h1><p className="sales-subtitle"><span className="sales-badge" data-stage={lead.stage}>{salesStageLabels[lead.stage]}</span> · Puntuación {lead.score ?? "—"}/100{lead.estimatedValue ? ` · ${money.format(lead.estimatedValue)}` : ""}</p></div><Link href="/sales/pipeline" className="sales-button secondary">← Volver al pipeline</Link></header>{!persistenceConfigured ? <div className="sales-alert"><strong>Modo de prueba.</strong> Puedes revisar todo el flujo; registrar resultados se activará al aplicar la migración de Ventas.</div> : null}<div className="sales-detail-grid"><div><section className="sales-panel"><h2>Siguiente movimiento</h2><p className="sales-note">{lead.nextAction || "No hay una siguiente acción definida."}</p><div className="sales-actions">{lead.phone ? <a className="sales-button" href={`tel:${lead.phone}`}>Llamar</a> : null}{whatsapp ? <a className="sales-button secondary" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}{lead.email ? <a className="sales-button secondary" href={`mailto:${lead.email}`}>Correo</a> : null}{lead.prototypeUrl ? <a className="sales-button secondary" href={lead.prototypeUrl} target="_blank" rel="noreferrer">Abrir prototipo</a> : null}</div></section><section className="sales-panel"><h2>Contexto</h2><p className="sales-note">{lead.notes || "Sin notas todavía."}</p><div className="sales-facts"><div className="sales-fact"><span>Responsable</span><strong>{lead.owner === "antero" ? "Antero" : "Vadim"}</strong></div><div className="sales-fact"><span>Próxima acción</span><strong>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"}</strong></div><div className="sales-fact"><span>Contacto</span><strong>{lead.contactName || "Sin identificar"}</strong></div><div className="sales-fact"><span>Último contacto</span><strong>{lead.lastContactAt ? timestamp.format(new Date(lead.lastContactAt)) : "Aún no"}</strong></div>{lead.websiteUrl ? <div className="sales-fact"><span>Web</span><a href={lead.websiteUrl} target="_blank" rel="noreferrer">Abrir ↗</a></div> : null}{lead.repositoryFullName ? <div className="sales-fact"><span>Repositorio</span><a href={`https://github.com/${lead.repositoryFullName}`} target="_blank" rel="noreferrer">{lead.repositoryFullName}</a></div> : null}</div></section><section className="sales-panel"><h2>Historial</h2><div className="sales-timeline">{activities.map((activity) => <article className="sales-activity" key={activity.id}><time>{timestamp.format(new Date(activity.createdAt))}</time><div><strong>{activity.outcome ? salesOutcomeLabels[activity.outcome] : activityLabels[activity.type] ?? activity.type}</strong><p>{activity.note || `Registrado por ${activity.actor}`}</p></div></article>)}{!activities.length ? <p className="sales-subtitle">Aún no hay actividad registrada.</p> : null}</div></section></div><aside><section className="sales-panel"><h2>Resultado de llamada</h2><form action={recordOutcomeAction} className="sales-outcome-form"><input type="hidden" name="leadId" value={lead.id}/><textarea name="note" placeholder="Nota rápida: qué dijo, qué necesita, cuándo volver a hablar…" disabled={!persistenceConfigured}/><div className="sales-outcome-grid">{salesOutcomes.map((outcome) => <button key={outcome} name="outcome" value={outcome} disabled={!persistenceConfigured}>{salesOutcomeLabels[outcome]}</button>)}</div></form></section></aside></div></>;
}
