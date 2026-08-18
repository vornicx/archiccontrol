import { DecisionCard } from "@/components/decision-card";
import { ProjectList } from "@/components/project-list";
import { RunList } from "@/components/run-list";
import { Topbar } from "@/components/topbar";
import { getAutomationHealth } from "@/lib/automation-health";
import { ensureFreshBenchmark } from "@/lib/benchmark-sync";
import { getDashboard } from "@/lib/repository";
import styles from "./overview.module.css";

const healthLabels = {
  healthy: "correcta",
  working: "trabajando",
  degraded: "degradada",
  blocked: "bloqueada",
} as const;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAge(hours: number | null): string {
  if (hours === null) return "Sin benchmark importado";
  if (hours < 1) return `hace ${Math.max(1, Math.round(hours * 60))} min`;
  return `hace ${Math.round(hours)} h`;
}

export default async function OverviewPage() {
  const benchmarkSync = await ensureFreshBenchmark();
  const [data, automationHealth] = await Promise.all([
    getDashboard(),
    getAutomationHealth(),
  ]);
  const benchmarkHealth = benchmarkSync.health;
  const actionableDecisions = benchmarkHealth.fresh
    ? data.needsVadim
    : data.needsVadim.filter((decision) => decision.type !== "final_approval");

  return (
    <>
      <Topbar eyebrow="Centro de mando" title="Hoy en Archic" meta={formatTimestamp(data.generatedAt)} />

      {!benchmarkHealth.fresh ? (
        <section className={styles.freshnessAlert} aria-label="Aviso de antigüedad de datos del benchmark">
          <div>
            <strong>Los datos de calidad necesitan actualizarse</strong>
            <p>
              Control ha intentado recuperar el benchmark, pero todavía no hay evidencia reciente. Las aprobaciones finales siguen bloqueadas para no promocionar a producción con datos antiguos.
              {benchmarkHealth.lastBenchmarkAt ? ` Última importación correcta: ${formatTimestamp(benchmarkHealth.lastBenchmarkAt)}.` : " No consta ninguna importación correcta."}
              {benchmarkSync.error ? ` Detalle de recuperación: ${benchmarkSync.error}.` : ""}
            </p>
          </div>
          <div className={styles.freshnessMeta}>{formatAge(benchmarkHealth.ageHours)}</div>
        </section>
      ) : null}

      <section className="metric-strip" aria-label="Estado operativo">
        <div className="metric metric-primary">
          <span className="metric-label">Tu cola</span>
          <div className="metric-value">{actionableDecisions.length}<small>{actionableDecisions.length === 1 ? " decisión" : " decisiones"}</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Calidad</span>
          <div className="metric-value">{data.portfolio.score.toFixed(1)}<small>/100</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Bloqueos</span>
          <div className="metric-value">{data.portfolio.activeGates}<small> activos</small></div>
        </div>
        <div className="metric" title={automationHealth.detail}>
          <span className="metric-label">Automatización</span>
          <div className="metric-value">{automationHealth.score}<small>% · {healthLabels[automationHealth.state]}</small></div>
        </div>
      </section>

      <div className="content-grid">
        <div>
          <section className="section" aria-labelledby="needs-vadim-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Tu intervención</p>
                <h2 className="section-title" id="needs-vadim-title">Decisiones que sí necesitan criterio humano</h2>
              </div>
              <span className="section-kicker">El resto sigue avanzando solo</span>
            </div>
            {actionableDecisions.length
              ? actionableDecisions.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
              : <div className="empty-decision"><div><strong>No tienes nada pendiente.</strong> Control está resolviendo la cola operativa de forma autónoma.</div></div>}
          </section>

          <section className="section" aria-labelledby="projects-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Producción</p>
                <h2 className="section-title" id="projects-title">Portfolio activo</h2>
              </div>
              <span className="section-kicker">{data.projects.length} proyectos</span>
            </div>
            <ProjectList projects={data.projects} />
          </section>
        </div>

        <aside className="section" aria-labelledby="runs-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Sistema</p>
              <h2 className="section-title" id="runs-title">Actividad reciente</h2>
            </div>
          </div>
          <RunList runs={data.runs} />
        </aside>
      </div>
    </>
  );
}
