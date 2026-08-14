import type { DecisionType } from "@/lib/types";
import { qualityStandard } from "@/quality/standard";

const permitted = new Set<DecisionType>(
  qualityStandard.needsVadimPolicy.allowedDecisionTypes as DecisionType[],
);

export interface EscalationCandidate {
  type?: DecisionType;
  retryable?: boolean;
  retryCount?: number;
  irreversible?: boolean;
  knownFix?: boolean;
  requiresBusinessJudgement?: boolean;
  qualityGatePassed?: boolean;
}

export function needsVadim(candidate: EscalationCandidate): boolean {
  if (candidate.retryable && (candidate.retryCount ?? 0) < qualityStandard.needsVadimPolicy.escalateAfterRetries) {
    return false;
  }
  if (candidate.knownFix && !candidate.irreversible) return false;
  if (candidate.qualityGatePassed && candidate.type === "final_approval") return true;
  if (candidate.requiresBusinessJudgement && candidate.type && permitted.has(candidate.type)) return true;
  return Boolean(candidate.irreversible && candidate.type && permitted.has(candidate.type));
}

