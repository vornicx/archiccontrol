import Link from "next/link";
import { getSalesData } from "@/sales/repository";
import { salesStageLabels, type SalesStage } from "@/sales/types";

const columns: SalesStage[] = ["researched","prototype","contacted","interested","meeting","proposal","negotiation","won"];
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function SalesPipelinePage() {
  const { leads } = await getSalesData();
  return (
    <>
      <header className="sales-header"><div><p className="sales-eyebrow">Commercial system</p><h1 className="sales-title">Pipeline.</h1><p className="sales-subtitle">Cada empresa tiene un estado, un responsable y una única siguiente acción.</p></div></header>
      <div className="sales-pipeline"><div className="sales-pipeline-grid">
        {columns.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.stage === stage);
          return <section className="sales-column" key={stage}><div className="sales-column-head"><h2>{salesStageLabels[stage]}</h2><span>{stageLeads.length}</span></div>{stageLeads.map((lead) => <Link href={`/sales/leads/${lead.id}`} className="sales-lead-card" key={lead.id}><h3>{lead.name}</h3><p>{lead.city || "—"} · {lead.nextAction || "Sin siguiente acción"}</p><div className="sales-card-foot"><span className="sales-money">{lead.estimatedValue ? money.format(lead.estimatedValue) : "—"}</span><span className="sales-score">{lead.score ?? "—"}</span></div></Link>)}</section>;
        })}
      </div></div>
    </>
  );
}
