import { getSalesData, getSalesPipelineStages } from "@/sales/repository";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function SalesPerformancePage() {
  const [{ leads }, stages] = await Promise.all([getSalesData(), getSalesPipelineStages()]);
  const active = leads.filter((lead) => !["won", "lost"].includes(lead.stage));
  const wonLeads = leads.filter((lead) => lead.stage === "won");
  const lost = leads.filter((lead) => lead.stage === "lost").length;
  const closed = wonLeads.length + lost;
  const winRate = closed ? Math.round((wonLeads.length / closed) * 100) : 0;
  const activeValue = active.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
  const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
  const averageWon = wonLeads.length ? wonValue / wonLeads.length : 0;
  const recurrentWon = wonLeads.reduce((sum, lead) => sum + (lead.maintenanceMonthly ?? 0), 0);
  const maxStageCount = Math.max(1, ...stages.map((stage) => leads.filter((lead) => lead.stage === stage.key).length));

  return (
    <>
      <header className="sales-header"><div><p className="sales-eyebrow">CRM · Conversión y valor</p><h1 className="sales-title">Rendimiento</h1><p className="sales-subtitle">Una lectura simple de cuánto estamos moviendo, cerrando y dejando caer.</p></div></header>
      <section className="sales-summary" aria-label="Métricas comerciales">
        <div className="sales-stat"><strong>{money.format(activeValue)}</strong><span>pipeline abierto</span></div>
        <div className="sales-stat"><strong>{winRate}%</strong><span>win rate sobre cerradas</span></div>
        <div className="sales-stat"><strong>{money.format(averageWon)}</strong><span>ticket medio ganado</span></div>
        <div className="sales-stat"><strong>{money.format(recurrentWon)}</strong><span>MRR ganado registrado</span></div>
      </section>
      <section className="sales-section">
        <div className="sales-section-head"><h2>Distribución del pipeline</h2><span>{leads.length} oportunidades registradas</span></div>
        <div className="sales-funnel">
          {stages.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage.key);
            const value = stageLeads.reduce((sum, lead) => sum + (lead.quotedPrice ?? lead.estimatedValue ?? 0), 0);
            return (
              <div className="sales-funnel-row" key={stage.key}>
                <span>{stage.label} · {money.format(value)}</span>
                <div className="sales-funnel-track"><div className="sales-funnel-fill" style={{ width: `${Math.max(stageLeads.length ? 4 : 0, (stageLeads.length / maxStageCount) * 100)}%` }} /></div>
                <strong>{stageLeads.length}</strong>
              </div>
            );
          })}
        </div>
        <p className="sales-kpi-note">Cerradas: {closed} · Ganadas: {wonLeads.length} · Perdidas: {lost} · Valor ganado registrado: {money.format(wonValue)}. El CRM usa el precio ofertado cuando existe y el potencial estimado como fallback.</p>
      </section>
    </>
  );
}
