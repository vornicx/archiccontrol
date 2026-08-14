# Repository audit · 2026-08-14

## Scope

Audited:

- `vornicx/archic-benchmark`
- `vornicx/archic-design-system`
- `vornicx/la-bocana-web-v8-mobile`
- `vornicx/marbellaforsale`
- `vornicx/marbellaboatcharter`
- `vornicx/Inmobiliaria-Noguera`

## What is already strong

Archic Benchmark has a sound measurement boundary:

- deterministic browser and HTTP checks remain valid when AI is unavailable;
- qualitative AI affects only qualitative categories;
- niche profiles change weights and business requirements;
- hard caps prevent severe defects from being hidden by a strong average;
- daily history, screenshots and token usage are retained;
- the portfolio already contains six active Archic projects.

Archic Design System v1.0 provides the canonical manual delivery contract: 87 checks across brand, visual craft, interaction, UX, responsive, content, technical and system integrity, plus a mandatory pass/fail Polish judgement.

## Gaps the control plane must close

1. **Measurement and operations are coupled.** Benchmark configuration, execution, history and static dashboard live in one repository. It cannot express a cross-project workflow or durable approval.
2. **Repository metadata is inert.** Project repository and ref are recorded but do not drive GitHub checks, fix branches, previews or deployments.
3. **No evidence graph.** A score and a manual sign-off are separate concepts. There is no shared entity connecting check → evidence → finding → fix → rerun → approval.
4. **No journey runner yet.** The README correctly identifies project-specific Playwright journeys as the next layer. Homepage signals cannot prove that a reservation or inquiry actually completes.
5. **No escalation policy.** A failed scan is immediately visible to a human even when the fix is deterministic and retryable.
6. **File storage is not a transactional operating store.** JSON history is useful as an artifact, but cannot safely coordinate concurrent agents, approvals or webhook delivery.
7. **Evidence serialization loses fidelity.** Some issue details currently render object evidence as `[object Object]`; Control stores raw JSON separately from the human summary.
8. **Project stacks vary materially.** The audited portfolio includes Next.js, static Node/Vercel and hybrid Vite/vinext projects. Quality execution must be adapter-based rather than assuming one framework.

## Architecture consequence

Keep Archic Benchmark as a specialist read-only measurement runner. Make Archic Control the durable control plane that ingests its reports, runs the versioned Quality Gate, owns workflow state, receives GitHub events and applies the “Needs Vadim” escalation policy.

The first milestone implements that boundary. It deliberately does not pretend the autofix agent fleet or every lead/deployment integration already exists.

