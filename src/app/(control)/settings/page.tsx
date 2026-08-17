import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { hasDatabase } from "@/lib/db";
import { isGithubAutomationConfigured } from "@/lib/github-app";

const integrations = [
  { name: "Archic Benchmark", detail: "Importación de informes firmados y evaluación del gate de calidad.", configured: Boolean(process.env.INTEGRATION_SECRET) },
  { name: "Investigación con OpenAI", detail: "Investigación web actual y selección estructurada del prospecto diario.", configured: Boolean(process.env.OPENAI_API_KEY) },
  { name: "GitHub", detail: "Webhooks verificados para checks, pull requests y ejecuciones de workflows.", configured: Boolean(process.env.GITHUB_WEBHOOK_SECRET) },
  { name: "Automatización de GitHub", detail: "Despacho de tareas a repositorios para el gate de calidad y los agentes de autocorrección.", configured: isGithubAutomationConfigured() },
  { name: "Publicador de prototipos", detail: "Crea el repositorio del prospecto seleccionado y escribe el prototipo generado por Archic.", configured: Boolean(process.env.GITHUB_AUTOMATION_TOKEN && process.env.GITHUB_PROSPECT_OWNER) },
  { name: "Publicador de Vercel", detail: "Crea el proyecto del prototipo desde GitHub y lanza el despliegue de producción.", configured: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID) },
  { name: "API de agentes", detail: "Asignación duradera de tareas, reintentos limitados y callbacks de finalización firmados.", configured: Boolean(process.env.AGENT_SECRET) },
  { name: "Neon Postgres", detail: "Persistencia de proyectos, prospectos, incidencias, decisiones, eventos e historial de auditoría.", configured: hasDatabase() },
  { name: "Reconciliador", detail: "Red de seguridad diaria para reintentos y ejecución idempotente de la prospección comercial.", configured: Boolean(process.env.CRON_SECRET) },
];

export default function SettingsPage() {
  return (
    <>
      <Topbar eyebrow="Plano de control" title="Integraciones" meta="Límites de mínimo privilegio" />
      <section className="settings-grid">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <h3>{integration.name}</h3>
            <p>{integration.detail}</p>
            <div className="integration-state"><StatusPill status={integration.configured ? "passed" : "needs_evidence"} label={integration.configured ? "configurado" : "requiere configuración"} /></div>
          </article>
        ))}
      </section>
    </>
  );
}
