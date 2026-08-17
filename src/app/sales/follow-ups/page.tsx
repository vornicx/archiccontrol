import Link from "next/link";
import { getSalesData } from "@/sales/repository";
import { salesStageLabels, type SalesLead } from "@/sales/types";

const fullDate = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function FollowupList({ leads }: { leads: SalesLead[] }) {
  return <div className="sales-task-list">{leads.map((lead) => <Link className="sales-task" href={`/sales/leads/${lead.id}`} key={lead.id}><span className="sales-rank">→</span><div><span className="sales-badge" data-stage={lead.stage}>{salesStageLabels[lead.stage]}</span><h3>{lead.name}</h3><p>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"} · {lead.city || "—"}</p></div><div className="sales-next"><strong>{lead.nextAction}</strong><span>{lead.nextActionAt ? fullDate.format(new Date(lead.nextActionAt)) : "Sin fecha"}</span></div><span className="sales-score">{lead.score ?? "—"}</span></Link>)}</div>;
}

export default async function FollowupsPage() {
  const { leads } = await getSalesData();
  const now = Date.now();
  const endToday = new Date(); endToday.setHours(23,59,59,999);
  const pending = leads.filter((lead) => lead.nextAction && lead.nextActionAt && !["won","lost"].includes(lead.stage)).sort((a,b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt)));
  const overdue = pending.filter((lead) => new Date(String(lead.nextActionAt)).getTime() < now);
  const today = pending.filter((lead) => { const value = new Date(String(lead.nextActionAt)).getTime(); return value >= now && value <= endToday.getTime(); });
  const later = pending.filter((lead) => new Date(String(lead.nextActionAt)).getTime() > endToday.getTime());
  return <><header className="sales-header"><div><p className="sales-eyebrow">Nothing gets cold</p><h1 className="sales-title">Follow-ups.</h1><p className="sales-subtitle">Si una conversación necesita volver a tocarse, aparece aquí hasta que tenga resultado.</p></div></header><section className="sales-followup-group"><h2>Vencidos · {overdue.length}</h2><FollowupList leads={overdue} /></section><section className="sales-followup-group"><h2>Hoy · {today.length}</h2><FollowupList leads={today} /></section><section className="sales-followup-group"><h2>Próximos · {later.length}</h2><FollowupList leads={later} /></section></>;
}
