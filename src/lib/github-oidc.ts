import "server-only";
import { createPublicKey, verify } from "node:crypto";

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";
const AUDIENCE = "archic-control";
const CLOCK_SKEW_SECONDS = 60;

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type GitHubOidcClaims = {
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
type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
type Jwks = { keys?: Jwk[] };

export interface VerifiedGitHubActionsIdentity {
  repository: string;
  ref: string;
  workflowRef: string;
  eventName: string;
  actor: string | null;
  runId: string | null;
}

let cachedJwks: { expiresAt: number; keys: Jwk[] } | null = null;

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
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

async function getJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.keys;
  const response = await fetch(JWKS_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`GitHub OIDC JWKS fetch failed (${response.status})`);
  const payload = await response.json() as Jwks;
  const keys = Array.isArray(payload.keys) ? payload.keys.filter((key) => key.kty === "RSA" && key.kid) : [];
  if (!keys.length) throw new Error("GitHub OIDC JWKS contains no usable RSA keys");
  cachedJwks = { expiresAt: now + 10 * 60_000, keys };
  return keys;
}

export async function verifyGitHubActionsOidcToken(token: string): Promise<VerifiedGitHubActionsIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("GitHub OIDC token is not a JWT");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  if (header.alg !== "RS256" || !header.kid) throw new Error("GitHub OIDC JWT algorithm or key id is invalid");
  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    const refreshed = await getJwks();
    const retry = refreshed.find((key) => key.kid === header.kid);
    if (!retry) throw new Error("GitHub OIDC signing key is unknown");
    const publicKey = createPublicKey({ key: retry, format: "jwk" });
    const valid = verify("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedClaims}`), publicKey, Buffer.from(encodedSignature, "base64url"));
    if (!valid) throw new Error("GitHub OIDC JWT signature is invalid");
  } else {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const valid = verify("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedClaims}`), publicKey, Buffer.from(encodedSignature, "base64url"));
    if (!valid) throw new Error("GitHub OIDC JWT signature is invalid");
  }
  return validateGitHubOidcClaims(decodeJsonPart<GitHubOidcClaims>(encodedClaims));
}
