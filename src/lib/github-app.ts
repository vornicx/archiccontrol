import "server-only";
import { createSign } from "node:crypto";
import { getControlPublicUrl } from "@/lib/control-url";

const API = "https://api.github.com";
const DEFAULT_CONTROL_REPOSITORY = "vornicx/archiccontrol";

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

function githubHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "archic-control/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

async function github<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: githubHeaders(token, init?.headers),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`GitHub ${response.status} ${path}: ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function githubContent(
  repositoryFullName: string,
  path: string,
  token: string,
): Promise<{ content: string; encoding: string } | null> {
  const endpoint = `/repos/${repositoryFullName}/contents/${path}`;
  const response = await fetch(`${API}${endpoint}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`GitHub ${response.status} ${endpoint}: ${detail}`);
  }
  return response.json() as Promise<{ content: string; encoding: string }>;
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

function controlRepository(): string {
  const configured = process.env.GITHUB_CONTROL_REPOSITORY?.trim();
  return configured || DEFAULT_CONTROL_REPOSITORY;
}

export function isGithubAutomationConfigured(): boolean {
  return Boolean(process.env.GITHUB_AUTOMATION_TOKEN || (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY));
}

export async function repositoryTaskReadiness(
  repositoryFullName: string,
  taskType: string,
): Promise<{ ready: boolean; detail: string }> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryFullName)) {
    return { ready: false, detail: "Repository name is invalid." };
  }

  if (taskType === "rubric") {
    const workerRepository = controlRepository();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(workerRepository)) {
      return { ready: false, detail: "Central rubric worker repository is invalid." };
    }
    const token = await repositoryToken(workerRepository);
    const [workflow, worker] = await Promise.all([
      githubContent(workerRepository, ".github/workflows/rubric-review.yml", token),
      githubContent(workerRepository, "scripts/rubric-worker.mjs", token),
    ]);
    if (!workflow || !worker) {
      return { ready: false, detail: "Central visual rubric worker is not installed." };
    }
    return { ready: true, detail: `Central visual rubric worker is installed in ${workerRepository}.` };
  }

  const token = await repositoryToken(repositoryFullName);
  const [workflow, worker, packageFile] = await Promise.all([
    githubContent(repositoryFullName, ".github/workflows/archic-control.yml", token),
    githubContent(repositoryFullName, ".archic/control-worker.mjs", token),
    githubContent(repositoryFullName, "package.json", token),
  ]);

  const missing: string[] = [];
  if (!workflow) missing.push(".github/workflows/archic-control.yml");
  if (!worker) missing.push(".archic/control-worker.mjs");
  if (!packageFile) missing.push("package.json");
  if (missing.length) {
    return { ready: false, detail: `Repository adapter missing: ${missing.join(", ")}` };
  }
  if (!packageFile) {
    return { ready: false, detail: "Repository package.json is unavailable." };
  }

  let scripts: Record<string, unknown> = {};
  try {
    if (packageFile.encoding !== "base64") throw new Error("Unexpected package.json encoding");
    const decoded = Buffer.from(packageFile.content.replaceAll("\n", ""), "base64").toString("utf8");
    const pkg = JSON.parse(decoded) as { scripts?: Record<string, unknown> };
    scripts = pkg.scripts ?? {};
  } catch {
    return { ready: false, detail: "Repository package.json could not be inspected for task capability." };
  }

  const requiredScript = taskType === "autofix" || taskType === "quality" || taskType === "smoke"
    ? null
    : taskType === "playwright"
      ? "test:e2e"
      : taskType === "preview"
        ? "archic:preview"
        : `archic:${taskType}`;

  if (requiredScript && typeof scripts[requiredScript] !== "string") {
    return { ready: false, detail: `Repository task capability missing: npm script ${requiredScript}` };
  }

  if (taskType === "quality") {
    const qualityScripts = ["lint", "typecheck", "test", "build", "test:e2e"];
    if (!qualityScripts.some((script) => typeof scripts[script] === "string")) {
      return { ready: false, detail: "Repository exposes no executable quality scripts." };
    }
  }

  return { ready: true, detail: "Repository worker adapter and task capability are installed." };
}

export async function dispatchRepositoryTask(
  repositoryFullName: string,
  payload: {
    taskId: string;
    taskType: string;
    projectId: string | null;
    attempt: number;
    input: unknown;
    callbackToken: string;
    controlUrl?: string;
  },
): Promise<void> {
  const targetRepository = payload.taskType === "rubric" ? controlRepository() : repositoryFullName;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(targetRepository)) throw new Error("Invalid repository name");
  const token = await repositoryToken(targetRepository);
  const clientPayload = {
    ...payload,
    controlUrl: payload.controlUrl ?? getControlPublicUrl(),
  };
  await github<void>(`/repos/${targetRepository}/dispatches`, token, {
    method: "POST",
    body: JSON.stringify({ event_type: "archic_control_task", client_payload: clientPayload }),
  });
}

export async function ensureRepositoryPullRequest(
  repositoryFullName: string,
  input: { head: string; title: string; body: string },
): Promise<{ url: string; number: number }> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryFullName)) throw new Error("Invalid repository name");
  if (!/^archic\/autofix-[A-Za-z0-9._-]+$/.test(input.head)) throw new Error("Invalid Archic autofix branch");
  const token = await repositoryToken(repositoryFullName);
  const repository = await github<{ default_branch: string; owner: { login: string } }>(`/repos/${repositoryFullName}`, token);
  const headQuery = encodeURIComponent(`${repository.owner.login}:${input.head}`);
  const existing = await github<Array<{ html_url: string; number: number }>>(
    `/repos/${repositoryFullName}/pulls?state=open&head=${headQuery}&base=${encodeURIComponent(repository.default_branch)}`,
    token,
  );
  if (existing[0]) return { url: existing[0].html_url, number: existing[0].number };

  const pull = await github<{ html_url: string; number: number }>(`/repos/${repositoryFullName}/pulls`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 20_000),
      head: input.head,
      base: repository.default_branch,
      draft: true,
      maintainer_can_modify: true,
    }),
  });
  return { url: pull.html_url, number: pull.number };
}
