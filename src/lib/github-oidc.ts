import "server-only";
import { createPublicKey, verify } from "node:crypto";
import {
  validateGitHubOidcClaims,
  type GitHubOidcClaims,
  type VerifiedGitHubActionsIdentity,
} from "@/lib/github-oidc-claims";

const JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type Jwk = Record<string, string> & { kid: string; kty: string };
type Jwks = { keys?: Array<Record<string, unknown>> };

let cachedJwks: { expiresAt: number; keys: Jwk[] } | null = null;

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

async function getJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.keys;
  const response = await fetch(JWKS_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`GitHub OIDC JWKS fetch failed (${response.status})`);
  const payload = await response.json() as Jwks;
  const keys = Array.isArray(payload.keys)
    ? payload.keys.flatMap((key) => {
        if (key.kty !== "RSA" || typeof key.kid !== "string") return [];
        const normalized: Record<string, string> = {};
        for (const [name, value] of Object.entries(key)) if (typeof value === "string") normalized[name] = value;
        return [{ ...normalized, kid: key.kid, kty: "RSA" } as Jwk];
      })
    : [];
  if (!keys.length) throw new Error("GitHub OIDC JWKS contains no usable RSA keys");
  cachedJwks = { expiresAt: now + 10 * 60_000, keys };
  return keys;
}

function verifyWithJwk(jwk: Jwk, signingInput: string, signature: string): boolean {
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  return verify("RSA-SHA256", Buffer.from(signingInput), publicKey, Buffer.from(signature, "base64url"));
}

export async function verifyGitHubActionsOidcToken(token: string): Promise<VerifiedGitHubActionsIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("GitHub OIDC token is not a JWT");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  if (header.alg !== "RS256" || !header.kid) throw new Error("GitHub OIDC JWT algorithm or key id is invalid");
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    const refreshed = await getJwks();
    const retry = refreshed.find((key) => key.kid === header.kid);
    if (!retry) throw new Error("GitHub OIDC signing key is unknown");
    if (!verifyWithJwk(retry, signingInput, encodedSignature)) throw new Error("GitHub OIDC JWT signature is invalid");
  } else if (!verifyWithJwk(jwk, signingInput, encodedSignature)) {
    throw new Error("GitHub OIDC JWT signature is invalid");
  }
  return validateGitHubOidcClaims(decodeJsonPart<GitHubOidcClaims>(encodedClaims));
}
