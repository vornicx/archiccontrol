import "server-only";
import { buildPrototypeFiles, type PrototypeFile } from "@/prospecting/template";
import { createProspectDecision, saveProspect } from "@/prospecting/repository";
import { db, hasDatabase } from "@/lib/db";
import { runDailyProspecting } from "@/prospecting/engine";
import type { ProspectEvidence, ResearchCandidate } from "@/prospecting/types";

type Row = Record<string, unknown>;
type GithubRepo = { id: number; name: string; full_name: string; html_url: string; default_branch: string };
type VercelProject = { id: string; name: string };
type VercelDeployment = { id: string; url?: string; readyState?: string };

function madridDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 46) || "archic-prospect";
}

function asJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function isPublishableCandidate(candidate: Partial<ResearchCandidate> | null): candidate is ResearchCandidate {
  return Boolean(
    candidate?.name &&
      candidate.city &&
      candidate.category &&
      candidate.websiteUrl &&
      typeof candidate.score === "number" &&
      candidate.score >= 80 &&
      candidate.price?.target != null &&
      candidate.copy?.heroTitle &&
      candidate.copy?.heroBody &&
      candidate.copy?.storyTitle &&
      candidate.copy?.storyBody &&
      candidate.copy?.ctaLabel &&
      Array.isArray(candidate.services) &&
      candidate.services.length > 0 &&
      Array.isArray(candidate.evidence) &&
      candidate.evidence.length >= 3 &&
      candidate.closureContradiction === false,
  );
}

async function urlReachable(value: string): Promise<boolean> {
  try {
    const response = await fetch(value, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 ArchicControl/1.0", Range: "bytes=0-2048" },
      signal: AbortSignal.timeout(8_000),
    });
    return response.status >= 200 && response.status < 500 && response.status !== 404 && response.status !== 410;
  } catch {
    return false;
  }
}

async function validateSeededCandidate(candidate: ResearchCandidate): Promise<{ ok: boolean; reason: string }> {
  const hosts = new Set<string>();
  for (const evidence of candidate.evidence) {
    try {
      hosts.add(new URL(evidence.url).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      // Ignore malformed evidence here; the minimum distinct-host rule below will catch it.
    }
  }
  if (hosts.size < 3) return { ok: false, reason: "Seeded candidate has fewer than three independent evidence domains." };
  if (candidate.closureContradiction) return { ok: false, reason: candidate.closureDetail || "Seeded candidate has a closure contradiction." };
  if (candidate.score < Number(process.env.PROSPECTING_MIN_SCORE ?? 80)) return { ok: false, reason: "Seeded candidate is below the commercial score threshold." };
  if (!(await urlReachable(candidate.websiteUrl))) return { ok: false, reason: "Seeded candidate website is not reachable at publication time." };
  return { ok: true, reason: "Verified candidate passed publication-time safeguards." };
}

async function extractOgImage(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 ArchicControl/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 350_000);
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match?.[1]) return null;
    return new URL(match[1], websiteUrl).toString();
  } catch {
    return null;
  }
}

async function githubRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.GITHUB_AUTOMATION_TOKEN;
  if (!token) throw new Error("GITHUB_AUTOMATION_TOKEN is not configured");
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "archic-control/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} ${path}: ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<T>;
}

async function createPrototypeRepository(candidate: ResearchCandidate, files: PrototypeFile[], runDate: string): Promise<GithubRepo> {
  const owner = process.env.GITHUB_PROSPECT_OWNER || "vornicx";
  const repoName = `${slugify(candidate.name)}-prototype-${runDate.replaceAll("-", "")}`.slice(0, 90);
  const repository = await githubRequest<GithubRepo>("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      description: `Archic concept prototype for ${candidate.name}`,
      private: process.env.PROSPECT_REPOS_PRIVATE === "true",
      auto_init: false,
    }),
  });
  if (repository.full_name.split("/")[0]?.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`GitHub token created ${repository.full_name}, expected owner ${owner}`);
  }
  for (const file of files) {
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    await githubRequest(`/repos/${repository.full_name}/contents/${encodedPath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Build Archic prototype: ${file.path}`,
        content: Buffer.from(file.content).toString("base64"),
      }),
    });
  }
  return repository;
}

async function getPrototypeRepository(fullName: string): Promise<GithubRepo> {
  return githubRequest<GithubRepo>(`/repos/${fullName}`, { method: "GET" });
}

async function vercelRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !teamId) throw new Error("VERCEL_TOKEN and VERCEL_TEAM_ID are required");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://api.vercel.com${path}${separator}teamId=${encodeURIComponent(teamId)}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Vercel ${response.status} ${path}: ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<T>;
}

async function deployPrototype(repository: GithubRepo): Promise<string> {
  const [owner, repo] = repository.full_name.split("/");
  const projectName = repository.name.slice(0, 100);
  const project = await vercelRequest<VercelProject>("/v11/projects", {
    method: "POST",
    body: JSON.stringify({ name: projectName, framework: "nextjs", gitRepository: { repo: repository.full_name, type: "github" } }),
  });
  const deployment = await vercelRequest<VercelDeployment>("/v13/deployments?forceNew=1", {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      project: project.id,
      target: "production",
      gitSource: { type: "github", org: owner, repo, ref: repository.default_branch || "main" },
    }),
  });
  if (!deployment.url) throw new Error(`Vercel created deployment ${deployment.id} without a deployment URL`);
  return `https://${deployment.url}`;
}

export async function publishVerifiedProspect() {
  const runDate = madridDate();
  if (!hasDatabase()) return { status: "not_configured", runDate, reason: "DATABASE_URL is required." } as const;

  const rows = (await db().query(`select * from prospects where run_date=$1::date limit 1`, [runDate])) as Row[];
  const row = rows[0];
  if (!row) return runDailyProspecting();

  const status = String(row.status || "");
  if (status === "ready") {
    return {
      status: "ready",
      runDate,
      prospectId: String(row.id),
      name: String(row.name),
      repositoryFullName: row.repository_full_name == null ? undefined : String(row.repository_full_name),
      deploymentUrl: row.deployment_url == null ? undefined : String(row.deployment_url),
    } as const;
  }
  if (status === "blocked" || status === "discarded") {
    return { status, runDate, prospectId: String(row.id), name: String(row.name), reason: row.error == null ? undefined : String(row.error) } as const;
  }
  if (status !== "verified") {
    return { status: "blocked", runDate, prospectId: String(row.id), name: String(row.name), reason: `Unexpected prospect status: ${status}` } as const;
  }

  const candidate = asJson<Partial<ResearchCandidate>>(row.research);
  if (!isPublishableCandidate(candidate)) {
    const reason = "Verified prospect is missing required grounded research fields.";
    await db().query(`update prospects set status='blocked', error=$2, updated_at=now() where id=$1`, [String(row.id), reason]);
    return { status: "blocked", runDate, prospectId: String(row.id), name: String(row.name), reason } as const;
  }

  const validation = await validateSeededCandidate(candidate);
  if (!validation.ok) {
    await saveProspect({
      id: String(row.id),
      runDate,
      candidate,
      status: "blocked",
      confidence: "high",
      evidence: candidate.evidence,
      repositoryFullName: row.repository_full_name == null ? null : String(row.repository_full_name),
      error: validation.reason,
    });
    return { status: "blocked", runDate, prospectId: String(row.id), name: candidate.name, reason: validation.reason } as const;
  }

  let repositoryFullName = row.repository_full_name == null ? null : String(row.repository_full_name);
  try {
    const repository = repositoryFullName
      ? await getPrototypeRepository(repositoryFullName)
      : await createPrototypeRepository(candidate, buildPrototypeFiles(candidate, await extractOgImage(candidate.websiteUrl)), runDate);

    repositoryFullName = repository.full_name;
    await saveProspect({
      id: String(row.id),
      runDate,
      candidate,
      status: "verified",
      confidence: "high",
      evidence: (asJson<ProspectEvidence[]>(row.evidence) ?? candidate.evidence),
      repositoryFullName,
    });

    const deploymentUrl = await deployPrototype(repository);
    await saveProspect({
      id: String(row.id),
      runDate,
      candidate,
      status: "ready",
      confidence: "high",
      evidence: (asJson<ProspectEvidence[]>(row.evidence) ?? candidate.evidence),
      repositoryFullName,
      deploymentUrl,
    });
    await createProspectDecision({
      id: `daily-prospect:${runDate}`,
      title: `Daily prototype ready: ${candidate.name}`,
      context: `Score ${candidate.score}/100. ${validation.reason} Prototype: ${deploymentUrl}. Repository: ${repositoryFullName}.`,
      recommendation: `Target price: €${candidate.price.target.toLocaleString("en-US")}. ${candidate.price.rationale}\n\nSuggested outreach: ${candidate.outreachMessage}`,
      risk: "This is an unsolicited concept prototype. Vadim should review brand accuracy, scope and outreach before contacting the business. Control never contacts prospects automatically.",
    });
    return { status: "ready", runDate, prospectId: String(row.id), name: candidate.name, repositoryFullName, deploymentUrl } as const;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await saveProspect({
      id: String(row.id),
      runDate,
      candidate,
      status: "blocked",
      confidence: "high",
      evidence: (asJson<ProspectEvidence[]>(row.evidence) ?? candidate.evidence),
      repositoryFullName,
      error: reason,
    });
    await createProspectDecision({
      id: `daily-prospect:${runDate}:blocked`,
      title: `Daily prototype blocked: ${candidate.name}`,
      context: `The ChatGPT-researched business passed verification, but publication did not complete. ${reason}`,
      recommendation: "Resolve the provider/configuration failure before contacting the business.",
      risk: "A partially created GitHub repository may exist if publication failed after repository creation.",
    });
    return { status: "blocked", runDate, prospectId: String(row.id), name: candidate.name, repositoryFullName: repositoryFullName ?? undefined, reason } as const;
  }
}
