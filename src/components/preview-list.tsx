import type { DeploymentPreview } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

const environmentLabels: Record<string, string> = {
  production: "producción",
  preview: "preview",
};

export function PreviewList({ previews }: { previews: DeploymentPreview[] }) {
  if (!previews.length) return <div className="empty-decision"><div><strong>Todavía no hay previews.</strong> Los artefactos de despliegue validados aparecerán aquí.</div></div>;
  return (
    <div className="ops-list">
      {previews.map((preview) => (
        <article className="ops-row preview-row" key={preview.id}>
          <div className="ops-main">
            <a className="ops-title ops-link" href={preview.url} rel="noreferrer" target="_blank">{preview.projectName} ↗</a>
            <div className="ops-meta">{environmentLabels[preview.environment] ?? preview.environment} · {preview.gitRef ?? "sin rama"} · {preview.gitSha?.slice(0, 7) ?? "SHA pendiente"}</div>
          </div>
          <div className="preview-evidence"><span>Calidad</span><StatusPill status={preview.qualityStatus} /></div>
          <div className="preview-evidence"><span>Smoke test</span><StatusPill status={preview.smokeStatus} /></div>
          <StatusPill status={preview.status} />
        </article>
      ))}
    </div>
  );
}

