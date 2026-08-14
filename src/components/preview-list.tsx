import type { DeploymentPreview } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";

export function PreviewList({ previews }: { previews: DeploymentPreview[] }) {
  if (!previews.length) return <div className="empty-decision"><div><strong>No previews yet.</strong>Validated deployment artifacts will appear here.</div></div>;
  return (
    <div className="ops-list">
      {previews.map((preview) => (
        <article className="ops-row preview-row" key={preview.id}>
          <div className="ops-main">
            <a className="ops-title ops-link" href={preview.url} rel="noreferrer" target="_blank">{preview.projectName} ↗</a>
            <div className="ops-meta">{preview.environment} · {preview.gitRef ?? "detached"} · {preview.gitSha?.slice(0, 7) ?? "SHA pending"}</div>
          </div>
          <div className="preview-evidence"><span>Gate</span><StatusPill status={preview.qualityStatus} /></div>
          <div className="preview-evidence"><span>Smoke</span><StatusPill status={preview.smokeStatus} /></div>
          <StatusPill status={preview.status} />
        </article>
      ))}
    </div>
  );
}

