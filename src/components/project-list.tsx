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
          <div>
            <div className="score">{project.score?.toFixed(1) ?? "—"} <small>/100</small></div>
            <div className="row-meta">Benchmark</div>
          </div>
          <div>
            <div className="score">{project.archicScore?.toFixed(1) ?? "—"} <small>/100</small></div>
            <div className="row-meta">{project.archicLevel ?? "Archic pendiente"}</div>
          </div>
          <div>
            <StatusPill status={project.gateStatus} />
            <div className="row-meta">{project.archicStatus ? project.archicStatus.replaceAll("_", " ") : `${project.openFindings} incidencia(s) abierta(s)`}</div>
          </div>
          <span className="arrow" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}
