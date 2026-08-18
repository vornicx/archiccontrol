import Link from "next/link";
import { getSalesClock, getSalesData, getSalesPipelineStages } from "@/sales/repository";
import styles from "./dashboard.module.css";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SalesDashboardPage() {
  const [{ leads, persistenceConfigured }, stages, currentTime] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
    getSalesClock(),
  ]);
  const now = new Date(currentTime).getTime();
  const stageMap = new Map(stages.map((stage) => [stage.key, stage]));
  const active = leads.filter((lead) => !["won", "lost"].includes(lead.stage));
  const pipelineValue = active.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
  const weightedValue = active.reduce((sum, lead) => {
    const amount = lead.quotedPrice ?? lead.estimatedValue ?? 0;
    return sum + amount * ((stageMap.get(lead.stage)?.probability ?? 0) / 100);
  }, 0);
  const overdue = active.filter((lead) => lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now);
  const noNext = active.filter((lead) => !lead.nextAction);
  const closing = active.filter((lead) => ["proposal", "negotiation"].includes(lead.stage));
  const queue = active
    .filter((lead) => lead.nextAction)
    .sort((a, b) => {
      const aTime = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 8);

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Centro comercial</p>
          <h1 className="sales-title">Resumen</h1>
          <p className="sales-subtitle">El estado real de ventas: dinero, urgencias, siguientes movimientos y oportunidades cerca de cerrar.</p>
        </div>
        <div className="sales-actions">
          <Link className="sales-button" href="/sales/new">Nuevo prospecto</Link>
          <Link className="sales-button secondary" href="/sales/opportunities">Ver cartera</Link>
        </div>
      </header>

      {!persistenceConfigured ? <div className="sales-alert"><strong>Modo de prueba.</strong> El CRM está renderizando datos de ejemplo porque la persistencia comercial no está disponible.</div> : null}

      <section className={styles.metrics} aria-label="Resumen comercial">
        <div className={styles.metric}><span>Pipeline abierto</span><strong>{money.format(pipelineValue)}</strong><small>{active.length} oportunidades activas</small></div>
        <div className={styles.metric}><span>Pipeline ponderado</span><strong>{money.format(weightedValue)}</strong><small>según probabilidad de cada etapa</small></div>
        <div className={styles.metric}><span>Acciones vencidas</span><strong>{overdue.length}</strong><small>{overdue.length ? "requieren movimiento" : "sin deuda comercial"}</small></div>
        <div className={styles.metric}><span>Cerca de cierre</span><strong>{closing.length}</strong><small>propuesta o negociación</small></div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Cola comercial</h2>
            <Link href="/sales/follow-ups">Abrir agenda</Link>
          </div>
          <div className={styles.queue}>
            {queue.map((lead) => {
              const isOverdue = Boolean(lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now);
              return (
                <Link href={`/sales/leads/${lead.id}`} className={styles.queueItem} key={lead.id}>
                  <div className={styles.queueMain}><strong>{lead.name}</strong><span>{lead.city || "—"} · {stageMap.get(lead.stage)?.label ?? lead.stage}</span></div>
                  <div className={styles.queueMeta}><strong>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"}</strong><span>{lead.quotedPrice != null ? money.format(lead.quotedPrice) : lead.estimatedValue != null ? `~${money.format(lead.estimatedValue)}` : "Sin valor"}</span></div>
                  <div className={styles.queueAction}><strong>{lead.nextAction}</strong><span className={isOverdue ? styles.danger : undefined}>{lead.nextActionAt ? when.format(new Date(lead.nextActionAt)) : "Sin fecha"}{isOverdue ? " · vencida" : ""}</span></div>
                </Link>
              );
            })}
            {!queue.length ? <div className={styles.empty}>No hay siguientes acciones abiertas.</div> : null}
          </div>
        </section>

        <aside>
          <div className={styles.attention}>
            <Link href="/sales/opportunities?attention=overdue" className={styles.attentionCard}><div><strong>Acciones vencidas</strong><span>Conversaciones que ya deberían haberse movido</span></div><span className={styles.count}>{overdue.length}</span></Link>
            <Link href="/sales/opportunities?attention=no-next" className={styles.attentionCard}><div><strong>Sin siguiente acción</strong><span>Oportunidades sin dueño operativo claro</span></div><span className={styles.count}>{noNext.length}</span></Link>
            <Link href="/sales/opportunities?stage=proposal" className={styles.attentionCard}><div><strong>Propuestas</strong><span>Negocios con precio sobre la mesa</span></div><span className={styles.count}>{active.filter((lead) => lead.stage === "proposal").length}</span></Link>
            <Link href="/sales/opportunities?stage=negotiation" className={styles.attentionCard}><div><strong>Negociación</strong><span>Prioridad máxima de cierre</span></div><span className={styles.count}>{active.filter((lead) => lead.stage === "negotiation").length}</span></Link>
          </div>

          <div className={styles.stageList} aria-label="Distribución del pipeline">
            {stages.filter((stage) => stage.active && !stage.terminal).map((stage) => {
              const stageLeads = active.filter((lead) => lead.stage === stage.key);
              const value = stageLeads.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
              return <div className={styles.stageRow} key={stage.key}><strong>{stage.label}</strong><span>{stageLeads.length}</span><span>{money.format(value)}</span></div>;
            })}
          </div>
        </aside>
      </div>
    </>
  );
}
