import Link from "next/link";
import { getSalesClock, getSalesData, getSalesPipelineStages } from "@/sales/repository";
import styles from "./pipeline.module.css";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const when = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SalesPipelinePage() {
  const [{ leads }, stages, currentTime] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
    getSalesClock(),
  ]);
  const now = new Date(currentTime).getTime();
  const columns = stages.filter((stage) => stage.active).sort((a, b) => a.position - b.position);

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Proceso comercial</p>
          <h1 className="sales-title">Pipeline</h1>
          <p className="sales-subtitle">La foto visual del proceso. Úsala para entender dónde se acumulan oportunidades; para buscar y filtrar, usa Oportunidades.</p>
        </div>
        <div className="sales-actions">
          <Link href="/sales/new" className="sales-button">+ Nuevo prospecto</Link>
          <Link href="/sales/opportunities" className="sales-button secondary">Ver oportunidades</Link>
        </div>
      </header>
      <div className={styles.helperBar}>
        <span><strong>{leads.filter((lead) => !["won", "lost"].includes(lead.stage)).length}</strong> oportunidades activas</span>
        <span>Desliza horizontalmente para recorrer todas las etapas.</span>
        <Link href="/sales/pipeline/settings">Configurar etapas</Link>
      </div>
      <div className={styles.board}>
        <div className={styles.grid}>
          {columns.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage.key);
            const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
            return (
              <section className={styles.column} data-stage={stage.key} key={stage.key}>
                <div className={styles.columnHead}>
                  <div className={styles.columnTitle}><h2>{stage.label}</h2><span>{stageLeads.length}</span></div>
                  <div className={styles.columnMeta}><strong>{money.format(stageValue)}</strong><span>{stage.probability}% prob.</span></div>
                </div>
                <div className={styles.cards}>
                  {stageLeads.map((lead) => {
                    const amount = lead.quotedPrice ?? lead.estimatedValue;
                    const overdue = Boolean(lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now && !stage.terminal);
                    return (
                      <Link href={`/sales/leads/${lead.id}`} className={styles.card} key={lead.id} data-overdue={overdue}>
                        <div className={styles.cardTop}>
                          <strong>{lead.name}</strong>
                          <span className={styles.amount}>{amount != null ? money.format(amount) : "—"}</span>
                        </div>
                        <span className={styles.context}>{[lead.city, lead.category].filter(Boolean).join(" · ") || "Sin contexto"}</span>
                        <div className={styles.action}>
                          <span className={styles.actionLabel}>Siguiente</span>
                          <strong>{lead.nextAction || "Sin siguiente acción"}</strong>
                          <span className={overdue ? styles.overdue : undefined}>{lead.nextActionAt ? when.format(new Date(lead.nextActionAt)) : "Sin fecha"}{overdue ? " · vencida" : ""}</span>
                        </div>
                        <div className={styles.cardFoot}>
                          <span className={styles.owner} data-owner={lead.owner}>{lead.owner === "antero" ? "Antero" : "Vadim"}</span>
                          <span className={styles.score}>score {lead.score ?? "—"}</span>
                        </div>
                      </Link>
                    );
                  })}
                  {!stageLeads.length ? <div className={styles.empty}>Sin oportunidades</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
