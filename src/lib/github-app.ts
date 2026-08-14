import "server-only";
import { createSign } from "node:crypto";

const API = "https://api.github.com";

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const configuredKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !configuredKey) throw new Error("GitHub App credentials are not configured");
  const now = Math.floor(Date.now() / 1_000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const key = configuredKey.replaceAll("\\n", "\n");
  return `${unsigned}.${signer.sign(key).toString("base64url")}`;
}

async function github<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "archic-control/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`GitHub ${response.status} ${path}: ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function repositoryToken(repositoryFullName: string): Promise<string> {
  if (process.env.GITHUB_AUTOMATION_TOKEN) return process.env.GITHUB_AUTOMATION_TOKEN;
  const jwt = appJwt();
  const installation = await github<{ id: number }>(`/repos/${repositoryFullName}/installation`, jwt);
  const access = await github<{ token: string }>(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({ repositories: [repositoryFullName.split("/")[1]] }),
  });
  return access.token;
}

export function isGithubAutomationConfigured(): boolean {
  return Boolean(process.env.GITHUB_AUTOMATION_TOKEN || (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY));
}

export async function dispatchRepositoryTask(
  repositoryFullName: string,
  payload: { taskId: string; taskType: string; projectId: string | null; attempt: number; input: unknown; callbackToken: string },
): Promise<void> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryFullName)) throw new Error("Invalid repository name");
  const token = await repositoryToken(repositoryFullName);
  await github<void>(`/repos/${repositoryFullName}/dispatches`, token, {
    method: "POST",
    body: JSON.stringify({ event_type: "archic_control_task", client_payload: payload }),
  });
}
