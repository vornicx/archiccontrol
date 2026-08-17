import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="project-list">
      {projects.map((project) => (
        <Link className="project-row" href={`/projects/${project.id}`} key={project.id}>
          <div>
            <div className="project-name">{project.name}</div>
            <div className="project-repo">{project.repositoryFullName}</div>
          </div>
          <div className="score">{project.score?.toFixed(1) ?? "—"} <small>/100</small></div>
          <div className={`delta ${(project.delta ?? 0) >= 0 ? "delta-positive" : "delta-negative"}`}>
            {project.delta == null ? "Sin variación" : `${project.delta >= 0 ? "+" : ""}${project.delta.toFixed(1)}`}
          </div>
          <div>
            <StatusPill status={project.gateStatus} />
            <div className="row-meta">{project.openFindings} incidencia(s) abierta(s)</div>
          </div>
          <span className="arrow" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}

