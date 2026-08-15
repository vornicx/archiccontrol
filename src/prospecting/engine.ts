import "server-only";
import { buildPrototypeFiles, type PrototypeFile } from "@/prospecting/template";
import { createProspectDecision, hasProspectingRun, knownBusinessNames, saveProspect } from "@/prospecting/repository";
import type { ProspectEvidence, ProspectingRunResult, ResearchCandidate } from "@/prospecting/types";
import { hasDatabase } from "@/lib/db";

type OpenAIResponse = { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
type GithubRepo = { id: number; name: string; full_name: string; html_url: string; default_branch: string };
type VercelProject = { id: string; name: string };
type VercelDeployment = { id: string; url?: string; readyState?: string };

const DEFAULT_MIN_SCORE = 80;
const DEFAULT_FRESH_DAYS = 30;

function madridDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 46) || "archic-prospect";
}

function outputText(payload: OpenAIResponse): string {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  throw new Error("OpenAI response did not contain structured output text");
}

function researchSchema() {
  const nullableString = { type: ["string", "null"] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["qualified", "candidate"],
    properties: {
      qualified: { type: "boolean" },
      candidate: {
        type: "object",
        additionalProperties: false,
        required: ["name","city","category","websiteUrl","socialUrl","summary","fitReason","websiteGap","score","services","contact","price","outreachMessage","copy","evidence","closureContradiction","closureDetail"],
        properties: {
          name: { type: "string" },
          city: { type: "string" },
          category: { type: "string" },
          websiteUrl: { type: "string" },
          socialUrl: nullableString,
          summary: { type: "string" },
          fitReason: { type: "string" },
          websiteGap: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          services: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
          contact: {
            type: "object", additionalProperties: false, required: ["email","phone","whatsapp"],
            properties: { email: nullableString, phone: nullableString, whatsapp: nullableString },
          },
          price: {
            type: "object", additionalProperties: false, required: ["currency","minimum","target","maximum","maintenanceMonthly","rationale"],
            properties: {
              currency: { type: "string", enum: ["EUR"] },
              minimum: { type: "integer", minimum: 0 },
              target: { type: "integer", minimum: 0 },
              maximum: { type: "integer", minimum: 0 },
              maintenanceMonthly: { type: ["integer", "null"], minimum: 0 },
              rationale: { type: "string" },
            },
          },
          outreachMessage: { type: "string" },
          copy: {
            type: "object", additionalProperties: false, required: ["eyebrow","heroTitle","heroBody","storyTitle","storyBody","ctaLabel"],
            properties: {
              eyebrow: { type: "string" }, heroTitle: { type: "string" }, heroBody: { type: "string" },
              storyTitle: { type: "string" }, storyBody: { type: "string" }, ctaLabel: { type: "string" },
            },
          },
          evidence: {
            type: "array", minItems: 0, maxItems: 8,
            items: {
              type: "object", additionalProperties: false, required: ["sourceName","url","kind","observedAt","detail"],
              properties: {
                sourceName: { type: "string" }, url: { type: "string" },
                kind: { type: "string", enum: ["official_site","social_recent","booking","map_listing","press","directory","other"] },
                observedAt: nullableString, detail: { type: "string" },
              },
            },
          },
          closureContradiction: { type: "boolean" },
          closureDetail: nullableString,
        },
      },
    },
  };
}

async function researchCandidate(excluded: string[]): Promise<{ qualified: boolean; candidate: ResearchCandidate }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const now = madridDate();
  const minimumScore = Number(process.env.PROSPECTING_MIN_SCORE ?? DEFAULT_MIN_SCORE);
  const freshDays = Number(process.env.PROSPECTING_FRESH_DAYS ?? DEFAULT_FRESH_DAYS);
  const prompt = `You are the commercial research engine for Archic, a premium web and custom-software studio in Spain. Today is ${now}.

Find and deeply research several real businesses that Archic could credibly improve, then return only the single strongest candidate. Prioritize Marbella, Puerto Banus, Costa del Sol, Malaga and Sevilla/Ecija when the commercial fit is strong. Favor businesses with real spending capacity and a visible gap between the quality of the business and its digital experience: luxury or premium automotive and rentals, detailing, restaurants, beach clubs, hospitality, real estate, yachts, premium retail, clinics, salons, construction/interiors and comparable high-value services.

Do not return any of these already handled or rejected names: ${excluded.slice(0, 80).join(", ") || "none"}.

Operating-status verification is mandatory. Do not call a candidate qualified unless you can provide at least three independent current web sources from distinct hostnames, including the official website when one exists, and at least one dated activity signal no older than ${freshDays} days. A directory listing by itself is never enough. Look for recent official social activity, current booking/availability, current offers, recent posts/news, an active official site, or another strong live signal. Search specifically for closure, relocation, temporary closure or inactivity contradictions. observedAt must be a date actually shown by the source for the post/update/event; never use today's access date as a fake publication date. If public evidence is ambiguous, set qualified=false rather than guessing.

Score commercial fit from 0-100. Only set qualified=true if the score is at least ${minimumScore}. Ground services, contact details and prototype copy in what you found; do not invent awards, fleet size, years in business, customer counts, prices or services. The outreach message is for Vadim to review and send himself; do not claim Archic is already working with the business. Recommend a realistic Archic project price in EUR based on scope and business value, with minimum, target, maximum and optional monthly maintenance.

The prototype copy should feel restrained, premium and specific to this business. Avoid generic AI phrases, hype, fake scarcity and unsupported luxury claims.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.PROSPECTING_MODEL || "gpt-5-mini",
      tools: [{ type: "web_search" }],
      input: prompt,
      text: { format: { type: "json_schema", name: "archic_daily_prospect", strict: true, schema: researchSchema() } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`OpenAI research failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  return JSON.parse(outputText(await response.json() as OpenAIResponse)) as { qualified: boolean; candidate: ResearchCandidate };
}

function hostname(value: string): string | null {
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

async function urlReachable(value: string): Promise<boolean> {
  try {
    const response = await fetch(value, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 ArchicControl/1.0", Range: "bytes=0-2048" }, signal: AbortSignal.timeout(8_000) });
    return response.status >= 200 && response.status < 500 && response.status !== 404 && response.status !== 410;
  } catch { return false; }
}

function isFresh(dateText: string | null, days: number): boolean {
  if (!dateText) return false;
  const date = new Date(dateText);
  if (!Number.isFinite(date.getTime())) return false;
  const delta = Date.now() - date.getTime();
  return delta >= 0 && delta <= days * 24 * 60 * 60 * 1_000;
}

async function verifyCandidate(candidate: ResearchCandidate): Promise<{ ok: boolean; confidence: "medium" | "high"; evidence: ProspectEvidence[]; reason: string }> {
  const minimumScore = Number(process.env.PROSPECTING_MIN_SCORE ?? DEFAULT_MIN_SCORE);
  const freshDays = Number(process.env.PROSPECTING_FRESH_DAYS ?? DEFAULT_FRESH_DAYS);
  if (candidate.score < minimumScore) return { ok: false, confidence: "medium", evidence: candidate.evidence, reason: `Commercial score ${candidate.score} is below ${minimumScore}.` };
  if (candidate.closureContradiction) return { ok: false, confidence: "medium", evidence: candidate.evidence, reason: candidate.closureDetail || "A credible closure/inactivity contradiction was found." };
  const hosts = new Set(candidate.evidence.map((item) => hostname(item.url)).filter((item): item is string => Boolean(item)));
  if (hosts.size < 3) return { ok: false, confidence: "medium", evidence: candidate.evidence, reason: "Fewer than three independent evidence domains." };
  const hasFreshSignal = candidate.evidence.some((item) => isFresh(item.observedAt, freshDays) && (item.kind === "social_recent" || item.kind === "booking" || item.kind === "press"));
  if (!hasFreshSignal) return { ok: false, confidence: "medium", evidence: candidate.evidence, reason: `No dated activity signal within ${freshDays} days.` };

  const [websiteOk, ...evidenceReachability] = await Promise.all([
    urlReachable(candidate.websiteUrl),
    ...candidate.evidence.slice(0, 6).map((item) => urlReachable(item.url)),
  ]);
  const checkedEvidence = candidate.evidence.map((item, index) => ({ ...item, reachable: index < evidenceReachability.length ? evidenceReachability[index] : undefined }));
  const reachableSources = evidenceReachability.filter(Boolean).length;
  if (!websiteOk) return { ok: false, confidence: "medium", evidence: checkedEvidence, reason: "Official/current website is not reachable." };
  if (reachableSources < 2) return { ok: false, confidence: "medium", evidence: checkedEvidence, reason: "Too few evidence URLs could be independently reached by Control." };
  return { ok: true, confidence: "high", evidence: checkedEvidence, reason: `${hosts.size} independent domains, recent activity and no closure contradiction.` };
}

async function extractOgImage(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 ArchicControl/1.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 350_000);
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match?.[1]) return null;
    return new URL(match[1], websiteUrl).toString();
  } catch { return null; }
}

async function githubRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.GITHUB_AUTOMATION_TOKEN;
  if (!token) throw new Error("GITHUB_AUTOMATION_TOKEN is not configured");
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "archic-control/1.0", "X-GitHub-Api-Version": "2022-11-28", ...init.headers },
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
  if (!repository.full_name.toLowerCase().startsWith(`${owner.toLowerCase()}/`) && owner.toLowerCase() !== repository.full_name.split("/")[0]?.toLowerCase()) {
    throw new Error(`GitHub token created ${repository.full_name}, expected owner ${owner}`);
  }

  for (const file of files) {
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    await githubRequest(`/repos/${repository.full_name}/contents/${encodedPath}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Build Archic prototype: ${file.path}`, content: Buffer.from(file.content).toString("base64") }),
    });
  }
  return repository;
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

async function deployPrototype(repository: GithubRepo): Promise<{ projectId: string; deploymentUrl: string }> {
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
  return { projectId: project.id, deploymentUrl: `https://${deployment.url}` };
}

function configMissing(): string[] {
  const required = ["OPENAI_API_KEY", "GITHUB_AUTOMATION_TOKEN", "VERCEL_TOKEN", "VERCEL_TEAM_ID"];
  return required.filter((name) => !process.env[name]);
}

export async function runDailyProspecting(): Promise<ProspectingRunResult> {
  const runDate = madridDate();
  if (!hasDatabase()) return { status: "not_configured", runDate, reason: "DATABASE_URL is required." };
  if (await hasProspectingRun(runDate)) return { status: "already_ran", runDate };
  const missing = configMissing();
  if (missing.length) return { status: "not_configured", runDate, reason: `Missing: ${missing.join(", ")}` };

  const excluded = await knownBusinessNames();
  let lastCandidate: ResearchCandidate | null = null;
  let lastReason = "No candidate met the verification policy.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const researched = await researchCandidate([...excluded, ...(lastCandidate ? [lastCandidate.name] : [])]);
    lastCandidate = researched.candidate;
    if (!researched.qualified) {
      lastReason = "Research did not identify a candidate strong enough for the daily slot.";
      continue;
    }
    const verification = await verifyCandidate(researched.candidate);
    if (!verification.ok) {
      lastReason = verification.reason;
      excluded.push(researched.candidate.name);
      continue;
    }

    const id = `${slugify(researched.candidate.name)}-${runDate}`;
    let repositoryFullName: string | null = null;
    try {
      await saveProspect({ id, runDate, candidate: researched.candidate, status: "verified", confidence: verification.confidence, evidence: verification.evidence });
      const heroImage = await extractOgImage(researched.candidate.websiteUrl);
      const files = buildPrototypeFiles(researched.candidate, heroImage);
      const repository = await createPrototypeRepository(researched.candidate, files, runDate);
      repositoryFullName = repository.full_name;
      await saveProspect({ id, runDate, candidate: researched.candidate, status: "verified", confidence: verification.confidence, evidence: verification.evidence, repositoryFullName });
      const deployment = await deployPrototype(repository);
      await saveProspect({ id, runDate, candidate: researched.candidate, status: "ready", confidence: verification.confidence, evidence: verification.evidence, repositoryFullName, deploymentUrl: deployment.deploymentUrl });
      await createProspectDecision({
        id: `daily-prospect:${runDate}`,
        title: `Daily prototype ready: ${researched.candidate.name}`,
        context: `Score ${researched.candidate.score}/100. ${verification.reason} Prototype: ${deployment.deploymentUrl}. Repository: ${repositoryFullName}.`,
        recommendation: `Target price: €${researched.candidate.price.target.toLocaleString("en-US")}. ${researched.candidate.price.rationale}\n\nSuggested outreach: ${researched.candidate.outreachMessage}`,
        risk: "This is an unsolicited concept prototype. Vadim should review brand accuracy, scope and outreach before contacting the business. Control never contacts prospects automatically.",
      });
      return { status: "ready", runDate, prospectId: id, name: researched.candidate.name, repositoryFullName, deploymentUrl: deployment.deploymentUrl };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await saveProspect({ id, runDate, candidate: researched.candidate, status: "blocked", confidence: verification.confidence, evidence: verification.evidence, repositoryFullName, error: reason });
      await createProspectDecision({
        id: `daily-prospect:${runDate}:blocked`,
        title: `Daily prototype blocked: ${researched.candidate.name}`,
        context: `The business passed commercial and operating-status verification, but publishing did not complete. ${reason}`,
        recommendation: "Resolve the provider/configuration failure and rerun the prospecting endpoint. Do not contact the business until a reviewed prototype is live.",
        risk: "A partially created GitHub repository may exist if the failure happened during Vercel publication.",
      });
      return { status: "blocked", runDate, prospectId: id, name: researched.candidate.name, repositoryFullName: repositoryFullName ?? undefined, reason };
    }
  }

  const id = `no-qualified-prospect-${runDate}`;
  await saveProspect({ id, runDate, candidate: lastCandidate ?? { name: "No qualified prospect", score: 0 }, status: "discarded", confidence: "medium", evidence: lastCandidate?.evidence ?? [], error: lastReason });
  return { status: "discarded", runDate, prospectId: id, name: lastCandidate?.name, reason: lastReason };
}
