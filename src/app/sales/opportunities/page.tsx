import Link from "next/link";
import { getSalesClock, getSalesData, getSalesPipelineStages } from "@/sales/repository";
import type { SalesOwner, SalesStage } from "@/sales/types";
import styles from "./opportunities.module.css";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

type Search = {
  q?: string;
  owner?: string;
  stage?: string;
  attention?: string;
};

function clean(value: string | undefined): string {
  return String(value ?? "").trim();
}

export default async function SalesOpportunitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [params, { leads }, stages, currentTime] = await Promise.all([
    searchParams,
    getSalesData(),
    getSalesPipelineStages(),
    getSalesClock(),
  ]);
  const now = new Date(currentTime).getTime();
  const q = clean(params.q).toLocaleLowerCase("es");
  const owner = clean(params.owner) as SalesOwner | "";
  const stage = clean(params.stage) as SalesStage | "";
  const attention = clean(params.attention);
  const stageLabels = new Map(stages.map((item) => [item.key, item.label]));

  const filtered = leads.filter((lead) => {
    const haystack = [lead.name, lead.city, lead.category, lead.contactName, lead.email, lead.phone, lead.source]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("es");
    if (q && !haystack.includes(q)) return false;
    if (owner && lead.owner !== owner) return false;
    if (stage && lead.stage !== stage) return false;
    if (attention === "active" && ["won", "lost"].includes(lead.stage)) return false;
    if (attention === "overdue" && (!lead.nextActionAt || new Date(lead.nextActionAt).getTime() >= now || ["won", "lost"].includes(lead.stage))) return false;
    if (attention === "no-next" && (lead.nextAction || ["won", "lost"].includes(lead.stage))) return false;
    return true;
  });

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Cartera comercial</p>
          <h1 className="sales-title">Oportunidades</h1>
          <p className="sales-subtitle">Busca, filtra y abre cualquier oportunidad sin depender del pipeline visual.</p>
        </div>
        <div className="sales-actions"><Link href="/sales/new" className="sales-button">Nuevo prospecto</Link></div>
      </header>

      <form className={styles.toolbar} action="/sales/opportunities" method="get">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Buscar negocio, ciudad, contacto…" aria-label="Buscar oportunidades" />
        <select name="owner" defaultValue={owner} aria-label="Filtrar por responsable">
          <option value="">Todos los responsables</option>
          <option value="antero">Antero</option>
          <option value="vadim">Vadim</option>
        </select>
        <select name="stage" defaultValue={stage} aria-label="Filtrar por etapa">
          <option value="">Todas las etapas</option>
          {stages.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
        </select>
        <select name="attention" defaultValue={attention} aria-label="Filtrar por atención">
          <option value="">Toda la cartera</option>
          <option value="active">Solo activas</option>
          <option value="overdue">Acción vencida</option>
          <option value="no-next">Sin siguiente acción</option>
        </select>
        <button type="submit">Filtrar</button>
      </form>

      <div className={styles.resultMeta}>
        <span>{filtered.length} de {leads.length} oportunidades</span>
        {(q || owner || stage || attention) ? <Link href="/sales/opportunities" className={styles.clear}>Limpiar filtros</Link> : null}
      </div>

      <div className={styles.table}>
        <div className={styles.head} aria-hidden="true">
          <span>Oportunidad</span><span>Etapa</span><span>Responsable</span><span>Contacto</span><span>Valor</span><span>Siguiente acción</span>
        </div>
        {filtered.map((lead) => {
          const amount = lead.quotedPrice ?? lead.estimatedValue;
          const overdue = Boolean(lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now && !["won", "lost"].includes(lead.stage));
          return (
            <Link href={`/sales/leads/${lead.id}`} className={styles.row} key={lead.id}>
              <div className={styles.company}>
                <strong>{lead.name}</strong>
                <span>{[lead.city, lead.category, lead.source].filter(Boolean).join(" · ") || "Sin contexto comercial"}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Etapa</span>
                <span className={styles.stage}>{stageLabels.get(lead.stage) ?? lead.stage}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Responsable</span>
                <span className={styles.owner}>{lead.owner === "antero" ? "Antero" : "Vadim"}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Contacto</span>
                <strong>{lead.contactName || "Sin contacto"}</strong>
                <span>{lead.phone || lead.email || "—"}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Valor</span>
                <span className={styles.value}>{amount != null ? money.format(amount) : "—"}</span>
                {lead.maintenanceMonthly != null ? <span>+ {money.format(lead.maintenanceMonthly)}/mes</span> : null}
              </div>
              <div className={styles.next}>
                <span className={styles.mobileLabel}>Siguiente acción</span>
                <strong>{lead.nextAction || "Sin siguiente acción"}</strong>
                <span className={overdue ? styles.overdue : undefined}>{lead.nextActionAt ? dateTime.format(new Date(lead.nextActionAt)) : "Sin fecha"}{overdue ? " · vencida" : ""}</span>
              </div>
            </Link>
          );
        })}
        {!filtered.length ? <div className={styles.empty}>No hay oportunidades que coincidan con estos filtros.</div> : null}
      </div>
    </>
  );
}
