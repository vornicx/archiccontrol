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
          <p className="sales-eyebrow">CRM · Hoy</p>
          <h1 className="sales-title">Resumen</h1>
          <p className="sales-subtitle">Lo importante primero: qué mover hoy, qué está atascado y cuánto negocio hay realmente en juego.</p>
        </div>
        <div className="sales-actions">
          <Link className="sales-button" href="/sales/new">+ Nuevo prospecto</Link>
          <Link className="sales-button secondary" href="/sales/opportunities">Abrir oportunidades</Link>
        </div>
      </header>

      {!persistenceConfigured ? <div className="sales-alert"><strong>Modo de prueba.</strong> El CRM está renderizando datos de ejemplo porque la persistencia comercial no está disponible.</div> : null}

      <section className={styles.metrics} aria-label="Resumen comercial">
        <Link href="/sales/opportunities?attention=active" className={styles.metric}>
          <span>Pipeline abierto</span><strong>{money.format(pipelineValue)}</strong><small>{active.length} oportunidades activas</small>
        </Link>
        <div className={styles.metric}>
          <span>Valor probable</span><strong>{money.format(weightedValue)}</strong><small>ponderado por la etapa actual</small>
        </div>
        <Link href="/sales/opportunities?attention=overdue" className={`${styles.metric} ${overdue.length ? styles.metricAlert : ""}`}>
          <span>Vencidos</span><strong>{overdue.length}</strong><small>{overdue.length ? "necesitan movimiento hoy" : "todo al día"}</small>
        </Link>
        <Link href="/sales/opportunities?stage=negotiation" className={`${styles.metric} ${styles.metricFocus}`}>
          <span>Cerca de cierre</span><strong>{closing.length}</strong><small>propuesta o negociación</small>
        </Link>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span className={styles.kicker}>Prioridad</span><h2>Qué toca ahora</h2></div>
            <Link href="/sales/follow-ups">Ver agenda completa</Link>
          </div>
          <div className={styles.queue}>
            {queue.map((lead) => {
              const isOverdue = Boolean(lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now);
              return (
                <Link href={`/sales/leads/${lead.id}`} className={styles.queueItem} key={lead.id}>
                  <span className={`${styles.statusDot} ${isOverdue ? styles.statusOverdue : ""}`} aria-hidden="true" />
                  <div className={styles.queueMain}><strong>{lead.name}</strong><span>{lead.city || "—"} · {stageMap.get(lead.stage)?.label ?? lead.stage}</span></div>
                  <div className={styles.queueMeta}><strong>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"}</strong><span>{lead.quotedPrice != null ? money.format(lead.quotedPrice) : lead.estimatedValue != null ? `~${money.format(lead.estimatedValue)}` : "Sin valor"}</span></div>
                  <div className={styles.queueAction}><strong>{lead.nextAction}</strong><span className={isOverdue ? styles.danger : undefined}>{lead.nextActionAt ? when.format(new Date(lead.nextActionAt)) : "Sin fecha"}{isOverdue ? " · vencida" : ""}</span></div>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </Link>
              );
            })}
            {!queue.length ? <div className={styles.empty}>No hay siguientes acciones abiertas.</div> : null}
          </div>
        </section>

        <aside className={styles.side}>
          <section className={styles.sideSection}>
            <div className={styles.sideHead}><span className={styles.kicker}>Atención</span><h2>Lo que no puede quedarse quieto</h2></div>
            <div className={styles.attention}>
              <Link href="/sales/opportunities?attention=overdue" className={`${styles.attentionCard} ${styles.attentionDanger}`}><div><strong>Acciones vencidas</strong><span>Ya deberían haberse movido</span></div><span className={styles.count}>{overdue.length}</span></Link>
              <Link href="/sales/opportunities?attention=no-next" className={`${styles.attentionCard} ${styles.attentionWarning}`}><div><strong>Sin siguiente acción</strong><span>Sin próximo paso definido</span></div><span className={styles.count}>{noNext.length}</span></Link>
              <Link href="/sales/opportunities?stage=proposal" className={styles.attentionCard}><div><strong>Propuestas</strong><span>Precio ya sobre la mesa</span></div><span className={styles.count}>{active.filter((lead) => lead.stage === "proposal").length}</span></Link>
              <Link href="/sales/opportunities?stage=negotiation" className={`${styles.attentionCard} ${styles.attentionFocus}`}><div><strong>Negociación</strong><span>Prioridad máxima de cierre</span></div><span className={styles.count}>{active.filter((lead) => lead.stage === "negotiation").length}</span></Link>
            </div>
          </section>

          <section className={styles.sideSection}>
            <div className={styles.sideHead}><span className={styles.kicker}>Pipeline</span><h2>Distribución</h2></div>
            <div className={styles.stageList} aria-label="Distribución del pipeline">
              {stages.filter((stage) => stage.active && !stage.terminal).map((stage) => {
                const stageLeads = active.filter((lead) => lead.stage === stage.key);
                const value = stageLeads.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
                return <Link href={`/sales/opportunities?stage=${stage.key}`} className={styles.stageRow} key={stage.key}><strong>{stage.label}</strong><span>{stageLeads.length}</span><span>{money.format(value)}</span></Link>;
              })}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
