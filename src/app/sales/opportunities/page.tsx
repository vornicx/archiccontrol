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

  const activeCount = leads.filter((lead) => !["won", "lost"].includes(lead.stage)).length;
  const overdueCount = leads.filter((lead) => lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now && !["won", "lost"].includes(lead.stage)).length;
  const noNextCount = leads.filter((lead) => !lead.nextAction && !["won", "lost"].includes(lead.stage)).length;

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Cartera</p>
          <h1 className="sales-title">Oportunidades</h1>
          <p className="sales-subtitle">Toda la cartera en una sola vista. Filtra rápido y entra en cualquier negocio sin perder contexto.</p>
        </div>
        <div className="sales-actions"><Link href="/sales/new" className="sales-button">+ Nuevo prospecto</Link></div>
      </header>

      <nav className={styles.quickFilters} aria-label="Filtros rápidos">
        <Link href="/sales/opportunities" data-active={!q && !owner && !stage && !attention}>Todas <span>{leads.length}</span></Link>
        <Link href="/sales/opportunities?attention=active" data-active={attention === "active"}>Activas <span>{activeCount}</span></Link>
        <Link href="/sales/opportunities?attention=overdue" data-tone="danger" data-active={attention === "overdue"}>Vencidas <span>{overdueCount}</span></Link>
        <Link href="/sales/opportunities?attention=no-next" data-tone="warning" data-active={attention === "no-next"}>Sin siguiente acción <span>{noNextCount}</span></Link>
        <Link href="/sales/opportunities?stage=negotiation" data-tone="focus" data-active={stage === "negotiation"}>Negociación</Link>
      </nav>

      <form className={styles.toolbar} action="/sales/opportunities" method="get">
        <div className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Buscar negocio, ciudad, contacto…" aria-label="Buscar oportunidades" />
        </div>
        <select name="owner" defaultValue={owner} aria-label="Filtrar por responsable">
          <option value="">Responsable: todos</option>
          <option value="antero">Antero</option>
          <option value="vadim">Vadim</option>
        </select>
        <select name="stage" defaultValue={stage} aria-label="Filtrar por etapa">
          <option value="">Etapa: todas</option>
          {stages.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
        </select>
        <select name="attention" defaultValue={attention} aria-label="Filtrar por atención">
          <option value="">Estado: cualquiera</option>
          <option value="active">Solo activas</option>
          <option value="overdue">Acción vencida</option>
          <option value="no-next">Sin siguiente acción</option>
        </select>
        <button type="submit">Aplicar</button>
      </form>

      <div className={styles.resultMeta}>
        <div><strong>{filtered.length}</strong><span> de {leads.length} oportunidades</span></div>
        {(q || owner || stage || attention) ? <Link href="/sales/opportunities" className={styles.clear}>Limpiar filtros</Link> : null}
      </div>

      <div className={styles.table}>
        <div className={styles.head} aria-hidden="true">
          <span>Oportunidad</span><span>Etapa</span><span>Responsable</span><span>Contacto</span><span>Valor</span><span>Siguiente acción</span><span />
        </div>
        {filtered.map((lead) => {
          const amount = lead.quotedPrice ?? lead.estimatedValue;
          const overdue = Boolean(lead.nextActionAt && new Date(lead.nextActionAt).getTime() < now && !["won", "lost"].includes(lead.stage));
          return (
            <Link href={`/sales/leads/${lead.id}`} className={styles.row} key={lead.id} data-overdue={overdue}>
              <div className={styles.company}>
                <strong>{lead.name}</strong>
                <span>{[lead.city, lead.category, lead.source].filter(Boolean).join(" · ") || "Sin contexto comercial"}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Etapa</span>
                <span className={styles.stage} data-stage={lead.stage}>{stageLabels.get(lead.stage) ?? lead.stage}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.mobileLabel}>Responsable</span>
                <span className={styles.owner} data-owner={lead.owner}>{lead.owner === "antero" ? "Antero" : "Vadim"}</span>
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
              <span className={styles.arrow} aria-hidden="true">›</span>
            </Link>
          );
        })}
        {!filtered.length ? <div className={styles.empty}><strong>No hay resultados</strong><span>Prueba a limpiar algún filtro o buscar con menos términos.</span></div> : null}
      </div>
    </>
  );
}
