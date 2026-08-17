import { PreviewList } from "@/components/preview-list";
import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { getAutomationData } from "@/lib/automation-repository";

const readinessCopy: Record<string, { label: string; detail: string }> = {
  Postgres: { label: "Postgres", detail: "Estado duradero del plano de control" },
  "Owner authentication": { label: "Autenticación del propietario", detail: "Sesión del propietario firmada" },
  "Machine API": { label: "API de agentes", detail: "Asignación autenticada de trabajo a agentes" },
  "GitHub events": { label: "Eventos de GitHub", detail: "Recepción firmada de eventos" },
  "GitHub automation": { label: "Automatización de GitHub", detail: "GitHub App instalada o token con permisos limitados" },
  "Benchmark ingestion": { label: "Importación del benchmark", detail: "Informes de calidad firmados" },
  "Scheduled control": { label: "Control programado", detail: "Despacho y reconciliación automáticos" },
};

export default async function DeploymentsPage() {
  const data = await getAutomationData();
  const ready = data.deploymentReadiness.every((check) => check.ready);
  return (
    <>
      <Topbar eyebrow="Pipeline de promoción" title="Previews y despliegues" meta={ready ? "Sistema configurado" : "Entorno incompleto"} />
      <section className="readiness-panel" aria-labelledby="readiness-title">
        <div><p className="eyebrow">Contrato de despliegue</p><h2 className="section-title" id="readiness-title">Preparación para producción</h2></div>
        <div className="readiness-grid">
          {data.deploymentReadiness.map((check) => {
            const localized = readinessCopy[check.label] ?? { label: check.label, detail: check.detail };
            return (
              <article className="readiness-check" key={check.label}>
                <div><strong>{localized.label}</strong><span>{localized.detail}</span></div>
                <StatusPill status={check.ready ? "passed" : "needs_evidence"} label={check.ready ? "listo" : "obligatorio"} />
              </article>
            );
          })}
        </div>
      </section>
      <section className="section">
        <div className="section-head"><div><p className="eyebrow">Artefactos inmutables</p><h2 className="section-title">Evidencia de promoción</h2></div><span className="section-kicker">{data.counts.readyPreviews} aprobables</span></div>
        <PreviewList previews={data.previews} />
      </section>
    </>
  );
}

