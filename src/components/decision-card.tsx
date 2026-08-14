import type { Decision } from "@/lib/types";
import { resolveDecisionAction } from "@/app/(control)/actions";

const typeLabels: Record<Decision["type"], string> = {
  final_approval: "Final approval",
  brand_direction: "Brand direction",
  risk_acceptance: "Risk acceptance",
  scope_change: "Scope change",
  irreversible_action: "Operating policy",
};

export function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <article className="decision-card">
      <span className="decision-type">{typeLabels[decision.type]}{decision.blocking ? " · blocking" : ""}</span>
      <h3>{decision.title}</h3>
      <p>{decision.context}</p>
      <div className="decision-recommendation">
        <strong>Control recommends</strong>
        <p>{decision.recommendation}</p>
      </div>
      <form action={resolveDecisionAction} className="decision-actions">
        <input type="hidden" name="decisionId" value={decision.id} />
        <input name="note" aria-label="Decision note" placeholder="Optional note for the audit log" />
        <button className="button button-quiet" name="outcome" value="rejected" type="submit">Reject</button>
        <button className="button button-primary" name="outcome" value="approved" type="submit">Approve</button>
      </form>
    </article>
  );
}

