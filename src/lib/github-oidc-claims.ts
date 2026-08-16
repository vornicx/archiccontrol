const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "archic-control";
const CLOCK_SKEW_SECONDS = 60;

export type GitHubOidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
  actor?: string;
  run_id?: string;
};

export interface VerifiedGitHubActionsIdentity {
  repository: string;
  ref: string;
  workflowRef: string;
  eventName: string;
  actor: string | null;
  runId: string | null;
}

function audienceContains(audience: string | string[] | undefined, expected: string): boolean {
  return typeof audience === "string" ? audience === expected : Array.isArray(audience) && audience.includes(expected);
}

export function validateGitHubOidcClaims(
  claims: GitHubOidcClaims,
  nowSeconds = Math.floor(Date.now() / 1_000),
): VerifiedGitHubActionsIdentity {
  if (claims.iss !== ISSUER) throw new Error("GitHub OIDC issuer is invalid");
  if (!audienceContains(claims.aud, AUDIENCE)) throw new Error("GitHub OIDC audience is invalid");
  if (!Number.isFinite(claims.exp) || Number(claims.exp) < nowSeconds - CLOCK_SKEW_SECONDS) throw new Error("GitHub OIDC token is expired");
  if (Number.isFinite(claims.nbf) && Number(claims.nbf) > nowSeconds + CLOCK_SKEW_SECONDS) throw new Error("GitHub OIDC token is not active yet");
  if (!Number.isFinite(claims.iat) || Number(claims.iat) > nowSeconds + CLOCK_SKEW_SECONDS || Number(claims.iat) < nowSeconds - 900) {
    throw new Error("GitHub OIDC token issue time is outside the allowed window");
  }

  const repository = String(claims.repository ?? "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("GitHub OIDC repository claim is invalid");
  if (claims.ref !== "refs/heads/main") throw new Error("Repository task leasing is restricted to refs/heads/main");
  const expectedWorkflowRef = `${repository}/.github/workflows/archic-control.yml@refs/heads/main`;
  if (claims.workflow_ref !== expectedWorkflowRef) throw new Error("GitHub OIDC workflow identity is not the Archic Control adapter");
  const eventName = String(claims.event_name ?? "");
  if (!new Set(["schedule", "push", "workflow_dispatch"]).has(eventName)) throw new Error("GitHub OIDC event is not allowed to lease repository work");

  return {
    repository,
    ref: claims.ref,
    workflowRef: claims.workflow_ref,
    eventName,
    actor: claims.actor ? String(claims.actor) : null,
    runId: claims.run_id ? String(claims.run_id) : null,
  };
}
