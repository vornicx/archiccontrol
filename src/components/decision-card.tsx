import type { Decision } from "@/lib/types";
import { resolveDecisionAction } from "@/app/(control)/actions";

const typeLabels: Record<Decision["type"], string> = {
  final_approval: "Aprobación final",
  brand_direction: "Dirección de marca",
  risk_acceptance: "Aceptación de riesgo",
  scope_change: "Cambio de alcance",
  irreversible_action: "Política operativa",
};

export function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <article className="decision-card">
      <span className="decision-type">{typeLabels[decision.type]}{decision.blocking ? " · bloqueante" : ""}</span>
      <h3>{decision.title}</h3>
      <p>{decision.context}</p>
      <div className="decision-recommendation">
        <strong>Control recomienda</strong>
        <p>{decision.recommendation}</p>
      </div>
      <form action={resolveDecisionAction} className="decision-actions">
        <input type="hidden" name="decisionId" value={decision.id} />
        <input name="note" aria-label="Nota de decisión" placeholder="Nota opcional para el registro de auditoría" />
        <button className="button button-quiet" name="outcome" value="rejected" type="submit">Rechazar</button>
        <button className="button button-primary" name="outcome" value="approved" type="submit">Aprobar</button>
      </form>
    </article>
  );
}
