import { ProjectList } from "@/components/project-list";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

export default async function ProjectsPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar eyebrow="Portfolio" title="Proyectos" meta={`${data.projects.length} activos`} />
      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Estado unificado</p>
            <h2 className="section-title">De calidad a producción</h2>
          </div>
          <span className="section-kicker">Repositorio · benchmark · gate</span>
        </div>
        <ProjectList projects={data.projects} />
      </section>
    </>
  );
}

