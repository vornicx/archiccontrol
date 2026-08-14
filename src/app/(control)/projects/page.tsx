import { ProjectList } from "@/components/project-list";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

export default async function ProjectsPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar eyebrow="Portfolio" title="Projects" meta={`${data.projects.length} active`} />
      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Unified state</p>
            <h2 className="section-title">From quality to production</h2>
          </div>
          <span className="section-kicker">Repository · benchmark · gate</span>
        </div>
        <ProjectList projects={data.projects} />
      </section>
    </>
  );
}

