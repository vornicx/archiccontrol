import Link from "next/link";
import { getSalesData, getSalesPipelineStages } from "@/sales/repository";
import { salesStageLabels } from "@/sales/types";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit" });

export default async function SalesTodayPage() {
  const [{ leads, persistenceConfigured }, stages] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
  ]);
  const stageLabels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const active = leads.filter((lead) => !["won", "lost"].includes(lead.stage));
  const anteroQueue = active.filter((lead) => lead.nextActionOwner === "antero" && lead.nextAction).sort((a,b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt)));
  const proposals = active.filter((lead) => ["proposal", "negotiation"].includes(lead.stage)).length;
  const pipelineValue = active.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
  return (
    <>
      <header className="sales-header">
        <div><p className="sales-eyebrow">Comercial · Prioridades de hoy</p><h1 className="sales-title">Ventas</h1><p className="sales-subtitle">Qué hay que mover hoy, quién lo tiene asignado y cuánto valor comercial está en juego.</p></div>
        <div className="sales-actions"><span className="sales-live"><strong>{active.length}</strong> oportunidades activas</span><Link className="sales-button" href="/sales/new">Nuevo prospecto</Link></div>
      </header>
      {!persistenceConfigured ? <div className="sales-alert"><strong>Modo de prueba.</strong> La interfaz ya está montada con vuestro pipeline actual; cuando apliquemos las migraciones, las llamadas, ediciones y seguimientos quedarán guardados.</div> : null}
      <section className="sales-summary" aria-label="Resumen comercial">
        <div className="sales-stat"><strong>{anteroQueue.length}</strong><span>acciones de Antero</span></div>
        <div className="sales-stat"><strong>{active.filter((lead) => lead.stage === "contacted").length}</strong><span>esperando respuesta</span></div>
        <div className="sales-stat"><strong>{proposals}</strong><span>propuestas abiertas</span></div>
        <div className="sales-stat"><strong>{money.format(pipelineValue)}</strong><span>pipeline comercial</span></div>
      </section>
      <section className="sales-section">
        <div className="sales-section-head"><h2>Prioridad de Antero</h2><span>ordenada por siguiente acción</span></div>
        <div className="sales-task-list">
          {anteroQueue.map((lead, index) => (
            <Link className="sales-task" href={`/sales/leads/${lead.id}`} key={lead.id}>
              <span className="sales-rank">{String(index + 1).padStart(2,"0")}</span>
              <div><span className="sales-badge" data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? salesStageLabels[lead.stage]}</span><h3>{lead.name}</h3><p>{lead.city || "—"} · {lead.category || "Negocio"}{lead.quotedPrice != null ? ` · ${money.format(lead.quotedPrice)}` : lead.estimatedValue != null ? ` · ~${money.format(lead.estimatedValue)}` : ""}</p></div>
              <div className="sales-next"><strong>{lead.nextAction}</strong><span>{lead.nextActionAt ? when.format(new Date(lead.nextActionAt)) : "Sin fecha"}</span></div>
              <span className="sales-score">{lead.score ?? "—"}</span>
            </Link>
          ))}
          {!anteroQueue.length ? <div className="sales-alert">No hay acciones comerciales asignadas a Antero.</div> : null}
        </div>
      </section>
      <section className="sales-section">
        <div className="sales-section-head"><h2>Prioridad de Vadim</h2><span>trabajo que desbloquea ventas</span></div>
        <div className="sales-task-list">
          {active.filter((lead) => lead.nextActionOwner === "vadim" && lead.nextAction).map((lead) => (
            <Link className="sales-task" href={`/sales/leads/${lead.id}`} key={lead.id}>
              <span className="sales-rank">→</span><div><span className="sales-badge" data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? salesStageLabels[lead.stage]}</span><h3>{lead.name}</h3><p>{lead.city || "—"} · {lead.category || "Negocio"}</p></div><div className="sales-next"><strong>{lead.nextAction}</strong><span>Vadim</span></div><span className="sales-score">{lead.score ?? "—"}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
