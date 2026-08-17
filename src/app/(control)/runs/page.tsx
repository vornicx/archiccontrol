import { RunList } from "@/components/run-list";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

export default async function RunsPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar eyebrow="Automatización" title="Ejecuciones de flujos" meta={`${data.portfolio.automationHealth}% de salud`} />
      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Registro de ejecución</p>
            <h2 className="section-title">Actividad más reciente</h2>
          </div>
          <span className="section-kicker">Cada fase permanece auditable</span>
        </div>
        <RunList runs={data.runs} />
      </section>
    </>
  );
}

