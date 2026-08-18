import Link from "next/link";
import { getSalesData, getSalesPipelineStages } from "@/sales/repository";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function SalesPipelinePage() {
  const [{ leads }, stages] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
  ]);
  const columns = stages.filter((stage) => stage.active).sort((a, b) => a.position - b.position);

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">Sistema comercial</p>
          <h1 className="sales-title">Pipeline</h1>
          <p className="sales-subtitle">Cada empresa tiene una etapa, un responsable, un valor y una única siguiente acción.</p>
        </div>
        <div className="sales-actions">
          <Link href="/sales/new" className="sales-button">Nuevo prospecto</Link>
          <Link href="/sales/pipeline/settings" className="sales-button secondary">Configurar pipeline</Link>
        </div>
      </header>
      <div className="sales-pipeline">
        <div className="sales-pipeline-grid" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))` }}>
          {columns.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage.key);
            return (
              <section className="sales-column" key={stage.key}>
                <div className="sales-column-head"><h2>{stage.label}</h2><span>{stageLeads.length}</span></div>
                {stageLeads.map((lead) => (
                  <Link href={`/sales/leads/${lead.id}`} className="sales-lead-card" key={lead.id}>
                    <h3>{lead.name}</h3>
                    <p>{lead.city || "—"} · {lead.nextAction || "Sin siguiente acción"}</p>
                    <div className="sales-card-foot">
                      <span className="sales-money">{lead.quotedPrice != null ? money.format(lead.quotedPrice) : lead.estimatedValue != null ? `~${money.format(lead.estimatedValue)}` : "—"}</span>
                      <span className="sales-score">{lead.score ?? "—"}</span>
                    </div>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
