# Archic Quality Standard v1.0

The machine-readable source is `config/quality-standard.v1.json`. It is derived from the frozen Archic Design System Quality Gate at the recorded commit SHA.

## Rules

- 87 canonical checks and the Polish pass are blocking for production.
- Automated evidence may prove only what the runner actually observes.
- Manual evidence is required for real devices, screen readers, content truth, delivered email and visual judgement.
- An exception is not an unchecked box. It is an explicit risk-acceptance decision with evidence and an audit record.
- A benchmark score below 90 blocks the approval boundary.
- An active benchmark hard gate blocks preview promotion.
- Critical and high unresolved findings block promotion.
- Passing the gate creates one final approval decision; it does not deploy automatically.

## “Needs Vadim”

Allowed:

- final production approval;
- brand direction when evidence supports more than one valid route;
- risk acceptance;
- scope change;
- irreversible action.

Suppressed:

- retryable automation failures within budget;
- ordinary QA findings;
- benchmark regressions with a known repair;
- successful runs and informational notices.

The purpose is not to hide problems. It is to route each problem to the cheapest safe resolver and protect Vadim's attention for decisions.

