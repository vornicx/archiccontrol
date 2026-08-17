import { StatusPill } from "@/components/status-pill";
import { TaskList } from "@/components/task-list";
import { Topbar } from "@/components/topbar";
import { getAutomationHealth } from "@/lib/automation-health";
import { getAutomationData } from "@/lib/automation-repository";

const healthLabels = {
  healthy: "correcta",
  working: "trabajando",
  degraded: "degradada",
  blocked: "bloqueada",
} as const;

const readinessCopy: Record<string, { label: string; detail: string }> = {
  Postgres: { label: "Postgres", detail: "Estado duradero del plano de control" },
  "Owner authentication": { label: "Autenticación del propietario", detail: "Sesión del propietario firmada" },
  "Machine API": { label: "API de agentes", detail: "Asignación autenticada de trabajo a agentes" },
  "GitHub events": { label: "Eventos de GitHub", detail: "Recepción firmada de eventos" },
  "GitHub automation": { label: "Automatización de GitHub", detail: "GitHub App instalada o token con permisos limitados" },
  "Benchmark ingestion": { label: "Importación del benchmark", detail: "Informes de calidad firmados" },
  "Scheduled control": { label: "Control programado", detail: "Despacho y reconciliación automáticos" },
};

export default async function AutomationPage() {
  const [data, health] = await Promise.all([getAutomationData(), getAutomationHealth()]);
  const readiness = [
    ...data.deploymentReadiness.filter((item) => item.label !== "Owner authentication"),
    {
      label: "Retry policy",
      ready: true,
      detail: "Repository capability is checked before an attempt is consumed. Retryable work backs off automatically; only terminal blocked work crosses the human boundary.",
    },
  ];

  return (
    <>
      <Topbar eyebrow="Ejecución autónoma" title="Cola de agentes" meta={`${health.score}% · ${healthLabels[health.state]}`} />
      <section className="metric-strip compact-metrics" aria-label="Métricas de ejecución de agentes">
        <div className="metric"><span className="metric-label">En cola</span><div className="metric-value">{data.counts.queued}</div></div>
        <div className="metric"><span className="metric-label">En ejecución</span><div className="metric-value">{data.counts.running}</div></div>
        <div className="metric"><span className="metric-label">Bloqueadas</span><div className="metric-value">{data.counts.blocked}</div></div>
        <div className="metric"><span className="metric-label">En cola y antiguas</span><div className="metric-value">{health.staleQueued}</div></div>
      </section>

      <section className="section" aria-labelledby="runtime-readiness-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Plano de ejecución</p>
            <h2 className="section-title" id="runtime-readiness-title">Preparación del sistema</h2>
          </div>
          <span className="section-kicker">{health.detail}</span>
        </div>
        <div className="gate-checks">
          {readiness.map((item) => {
            const localized = item.label === "Retry policy"
              ? { label: "Política de reintentos", detail: "Antes de consumir un intento se comprueba que el repositorio pueda ejecutar la tarea. Los errores recuperables se reintentan automáticamente; solo los bloqueos definitivos pasan al límite humano." }
              : readinessCopy[item.label] ?? { label: item.label, detail: item.detail };
            return (
              <article className="gate-check" key={item.label}>
                <StatusPill status={item.ready ? "passed" : "failed"} label={item.ready ? "listo" : "falta configurar"} />
                <div><h3>{localized.label}</h3><p>{localized.detail}</p></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><p className="eyebrow">Asignado y auditable</p><h2 className="section-title">Trabajo gestionado por Control</h2></div><span className="section-kicker">Prioridad primero · idempotente</span></div>
        <TaskList tasks={data.tasks} />
      </section>
    </>
  );
}
