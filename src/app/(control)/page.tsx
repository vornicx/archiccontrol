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
      <Topbar title="Resumen operativo" meta={formatTimestamp(data.generatedAt)} />

      {!benchmarkHealth.fresh ? (
        <section className={styles.freshnessAlert} aria-label="Aviso de antigüedad de datos del benchmark">
          <div>
            <strong>Los datos del benchmark están desactualizados</strong>
            <p>
              Control ha intentado actualizarlos automáticamente, pero todavía no hay evidencia de calidad reciente. Las aprobaciones finales siguen bloqueadas.
              {benchmarkHealth.lastBenchmarkAt ? ` Última importación correcta: ${formatTimestamp(benchmarkHealth.lastBenchmarkAt)}.` : " No consta ninguna importación correcta."}
              {benchmarkSync.error ? ` Detalle de recuperación: ${benchmarkSync.error}.` : ""}
            </p>
          </div>
          <div className={styles.freshnessMeta}>{formatAge(benchmarkHealth.ageHours)}</div>
        </section>
      ) : null}

      <section className="metric-strip" aria-label="Métricas del portfolio">
        <div className="metric metric-primary">
          <span className="metric-label">Necesita a Vadim</span>
          <div className="metric-value">{actionableDecisions.length}<small>{actionableDecisions.length === 1 ? " decisión" : " decisiones"}</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Calidad del portfolio</span>
          <div className="metric-value">{data.portfolio.score.toFixed(1)}<small>/100</small></div>
        </div>
        <div className="metric">
          <span className="metric-label">Bloqueos activos</span>
          <div className="metric-value">{data.portfolio.activeGates}<small> bloqueos</small></div>
        </div>
        <div className="metric" title={automationHealth.detail}>
          <span className="metric-label">Salud de automatización</span>
          <div className="metric-value">{automationHealth.score}<small>% · {healthLabels[automationHealth.state]}</small></div>
        </div>
      </section>

      <div className="content-grid">
        <div>
          <section className="section" aria-labelledby="needs-vadim-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Límite humano</p>
                <h2 className="section-title" id="needs-vadim-title">Necesita a Vadim</h2>
              </div>
              <span className="section-kicker">Todo lo demás se queda en Control</span>
            </div>
            {actionableDecisions.length
              ? actionableDecisions.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
              : <div className="empty-decision"><div><strong>No hay decisiones pendientes.</strong> Control está resolviendo la cola operativa de forma autónoma.</div></div>}
          </section>

          <section className="section" aria-labelledby="projects-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Portfolio activo</p>
                <h2 className="section-title" id="projects-title">Evolución de calidad</h2>
              </div>
              <span className="section-kicker">{data.projects.length} proyectos</span>
            </div>
            <ProjectList projects={data.projects} />
          </section>
        </div>

        <aside className="section" aria-labelledby="runs-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Trabajo autónomo</p>
              <h2 className="section-title" id="runs-title">Ejecuciones recientes</h2>
            </div>
          </div>
          <RunList runs={data.runs} />
        </aside>
      </div>
    </>
  );
}
