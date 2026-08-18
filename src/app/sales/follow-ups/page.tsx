import Link from "next/link";
import { getSalesClock, getSalesData, getSalesPipelineStages } from "@/sales/repository";
import type { SalesLead } from "@/sales/types";

const fullDate = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const madridDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

function FollowupList({ leads, stageLabels }: { leads: SalesLead[]; stageLabels: Map<string, string> }) {
  return (
    <div className="sales-task-list">
      {leads.map((lead) => (
        <Link className="sales-task" href={`/sales/leads/${lead.id}`} key={lead.id}>
          <span className="sales-rank">→</span>
          <div><span className="sales-badge" data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? lead.stage}</span><h3>{lead.name}</h3><p>{lead.nextActionOwner === "antero" ? "Antero" : "Vadim"} · {lead.city || "—"}</p></div>
          <div className="sales-next"><strong>{lead.nextAction}</strong><span>{lead.nextActionAt ? fullDate.format(new Date(lead.nextActionAt)) : "Sin fecha"}</span></div>
          <span className="sales-score">{lead.score ?? "—"}</span>
        </Link>
      ))}
    </div>
  );
}

export default async function FollowupsPage() {
  const [{ leads }, currentTime, stages] = await Promise.all([getSalesData(), getSalesClock(), getSalesPipelineStages()]);
  const stageLabels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const currentDate = new Date(currentTime);
  const now = currentDate.getTime();
  const todayKey = madridDay.format(currentDate);
  const pending = leads.filter((lead) => lead.nextAction && lead.nextActionAt && !["won","lost"].includes(lead.stage)).sort((a,b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt)));
  const overdue = pending.filter((lead) => new Date(String(lead.nextActionAt)).getTime() < now);
  const today = pending.filter((lead) => {
    const date = new Date(String(lead.nextActionAt));
    return date.getTime() >= now && madridDay.format(date) === todayKey;
  });
  const later = pending.filter((lead) => {
    const date = new Date(String(lead.nextActionAt));
    return date.getTime() >= now && madridDay.format(date) !== todayKey;
  });

  return (
    <>
      <header className="sales-header"><div><p className="sales-eyebrow">CRM · Próximos movimientos</p><h1 className="sales-title">Agenda</h1><p className="sales-subtitle">Todo seguimiento con fecha vive aquí hasta que tenga resultado o una nueva siguiente acción.</p></div></header>
      <section className="sales-followup-group"><h2>Vencidos · {overdue.length}</h2><FollowupList leads={overdue} stageLabels={stageLabels} /></section>
      <section className="sales-followup-group"><h2>Hoy · {today.length}</h2><FollowupList leads={today} stageLabels={stageLabels} /></section>
      <section className="sales-followup-group"><h2>Próximos · {later.length}</h2><FollowupList leads={later} stageLabels={stageLabels} /></section>
    </>
  );
}
