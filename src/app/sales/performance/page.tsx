import { getSalesData } from "@/sales/repository";

export default async function SalesPerformancePage() {
  const { leads } = await getSalesData();
  const total = leads.length || 1;
  const contacted = leads.filter((lead) => !["found","researched","prototype"].includes(lead.stage)).length;
  const opportunities = leads.filter((lead) => ["interested","meeting","proposal","negotiation","won"].includes(lead.stage)).length;
  const proposals = leads.filter((lead) => ["proposal","negotiation","won"].includes(lead.stage)).length;
  const won = leads.filter((lead) => lead.stage === "won").length;
  const rows = [{label:"Leads",value:leads.length},{label:"Contactados",value:contacted},{label:"Oportunidades",value:opportunities},{label:"Propuestas",value:proposals},{label:"Ganados",value:won}];
  return <><header className="sales-header"><div><p className="sales-eyebrow">Ejecución, no métricas de vanidad</p><h1 className="sales-title">Rendimiento.</h1><p className="sales-subtitle">La pregunta no es cuántas llamadas hicimos. Es dónde se rompe el proceso comercial.</p></div></header><section className="sales-summary"><div className="sales-stat"><strong>{leads.length}</strong><span>leads registrados</span></div><div className="sales-stat"><strong>{contacted}</strong><span>contactados</span></div><div className="sales-stat"><strong>{opportunities}</strong><span>oportunidades</span></div><div className="sales-stat"><strong>{won}</strong><span>ventas</span></div></section><section className="sales-section"><div className="sales-section-head"><h2>Embudo actual</h2><span>V1 · estado del pipeline</span></div><div className="sales-funnel">{rows.map((row) => <div className="sales-funnel-row" key={row.label}><span>{row.label}</span><div className="sales-funnel-track"><div className="sales-funnel-fill" style={{width:`${Math.max(2,(row.value/total)*100)}%`}} /></div><strong>{row.value}</strong></div>)}</div><p className="sales-kpi-note">En la siguiente iteración, estas cifras pasarán de ser una foto del pipeline a medir actividad real por semana: llamadas, conversaciones, propuestas, tiempo de respuesta y conversión por origen.</p></section></>;
}
