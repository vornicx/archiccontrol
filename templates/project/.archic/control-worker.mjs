import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const taskType = process.env.TASK_TYPE;
const taskId = process.env.TASK_ID;
const controlUrl = process.env.CONTROL_URL;
const callbackToken = process.env.CALLBACK_TOKEN;
const baseRef = process.env.BASE_REF || "main";
const input = JSON.parse(process.env.TASK_INPUT || "{}");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const scripts = pkg.scripts || {};
const evidence = [];

if (!taskType || !taskId || !controlUrl || !callbackToken) {
  throw new Error("Archic Control task environment is incomplete");
}

function run(script, required = false) {
  if (!scripts[script]) {
    if (required) throw new Error(`Required script is missing: ${script}`);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn("npm", ["run", script], { stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      evidence.push({ check: script, status: code === 0 ? "passed" : "failed", durationMs: Date.now() - started });
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function git(args, options = {}) {
  const result = await execFileAsync("git", args, { maxBuffer: 8 * 1024 * 1024, ...options });
  return String(result.stdout || "").trim();
}

function normalizedPath(value) {
  const path = String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function safeContextPath(value) {
  const path = normalizedPath(value);
  if (!path) return false;
  const lower = path.toLowerCase();
  if (lower === "package-lock.json" || lower === "pnpm-lock.yaml" || lower === "yarn.lock" || lower === "bun.lock" || lower === "bun.lockb" || lower === "vercel.json") return false;
  if ([".git/", ".github/", ".archic/", "node_modules/", "db/"].some((prefix) => lower.startsWith(prefix))) return false;
  if (lower === ".env" || lower.startsWith(".env.") || lower.includes("secret") || lower.includes("credential")) return false;
  if (path === "package.json") return true;
  return /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html|mdx?|json|txt|xml)$/i.test(path);
}

function safeChangePath(value, repositoryPaths) {
  const path = normalizedPath(value);
  if (!path || path === "package.json" || !safeContextPath(path)) return false;
  if (repositoryPaths.has(path)) return true;
  if (path === "robots.txt" || path === "sitemap.xml") return true;
  return path.startsWith("src/") || path.startsWith("app/") || path.startsWith("public/");
}

function findingText() {
  const finding = input && typeof input.finding === "object" && input.finding ? input.finding : {};
  return [input.summary, finding.id, finding.severity, finding.detail, finding.recommendation]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scorePath(path, finding) {
  const lower = path.toLowerCase();
  let score = path === "package.json" ? 30 : 0;
  if (/^(src|app|pages|components)\//.test(lower)) score += 12;
  if (/(page|layout|app|index|main|home|global|style|header|footer|nav)/.test(lower)) score += 8;

  const groups = [
    { match: /(canonical|sitemap|robots|seo|metadata|title|h1|structured)/, hints: /(seo|metadata|sitemap|robots|layout|page|head|schema|jsonld|next\.config)/ },
    { match: /(tiny|target|unnamed|accessib|button|contact|cta|cookie|hero|mobile|tap)/, hints: /(css|style|page|component|header|footer|nav|form|button|cookie|hero|contact)/ },
    { match: /(csp|security|header)/, hints: /(middleware|next\.config|header|security|server)/ },
    { match: /(image|alt|media|visual)/, hints: /(image|gallery|hero|media|page|component)/ },
  ];
  for (const group of groups) {
    if (group.match.test(finding) && group.hints.test(lower)) score += 35;
  }

  for (const token of finding.split(/[^a-z0-9]+/).filter((item) => item.length >= 5).slice(0, 20)) {
    if (lower.includes(token)) score += 5;
  }
  return score;
}

async function readContextFile(path) {
  try {
    const content = await readFile(path, "utf8");
    if (!content || Buffer.byteLength(content, "utf8") > 80_000) return null;
    return { path, content };
  } catch {
    return null;
  }
}

async function buildAutofixContext() {
  const tracked = (await git(["ls-files"]))
    .split("\n")
    .map(normalizedPath)
    .filter((path) => path && safeContextPath(path));
  const repositoryPaths = new Set(tracked);
  const finding = findingText();
  const ranked = tracked
    .map((path) => ({ path, score: scorePath(path, finding) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const fileIndex = ranked.slice(0, 700).map((item) => item.path);
  if (repositoryPaths.has("package.json") && !fileIndex.includes("package.json")) fileIndex.unshift("package.json");

  const files = [];
  let bytes = 0;
  for (const item of ranked) {
    if (files.length >= 12) break;
    const file = await readContextFile(item.path);
    if (!file) continue;
    const size = Buffer.byteLength(file.content, "utf8");
    if (bytes + size > 150_000) continue;
    files.push(file);
    bytes += size;
  }
  if (!files.some((file) => file.path === "package.json")) {
    const packageFile = await readContextFile("package.json");
    if (packageFile && bytes + Buffer.byteLength(packageFile.content, "utf8") <= 150_000) files.unshift(packageFile);
  }
  if (!files.length) throw new Error("Autofix could not collect safe repository context");
  return { fileIndex: Array.from(new Set(fileIndex)).slice(0, 700), files, repositoryPaths };
}

async function postJson(path, body) {
  const response = await fetch(`${controlUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Archic Control ${response.status} ${path}: ${payload.error || "request failed"}`);
  return payload;
}

async function requestAutofixPlan(fileIndex, files, round) {
  const response = await postJson(`/api/agents/tasks/${taskId}/autofix-plan`, {
    leaseToken: callbackToken,
    round,
    fileIndex,
    files,
  });
  if (!response.plan || typeof response.plan !== "object") throw new Error("Autofix planner returned no plan");
  return response.plan;
}

async function executeAutofix() {
  const context = await buildAutofixContext();
  let files = [...context.files];
  let plan = await requestAutofixPlan(context.fileIndex, files, 1);

  if (plan.action === "need_files") {
    let bytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
    for (const requested of Array.isArray(plan.requestedPaths) ? plan.requestedPaths : []) {
      const path = normalizedPath(requested);
      if (!path || !context.fileIndex.includes(path) || !safeContextPath(path) || files.some((file) => file.path === path)) continue;
      const file = await readContextFile(path);
      if (!file) continue;
      const size = Buffer.byteLength(file.content, "utf8");
      if (bytes + size > 178_000 || files.length >= 18) continue;
      files.push(file);
      bytes += size;
    }
    plan = await requestAutofixPlan(context.fileIndex, files, 2);
  }

  if (plan.action !== "apply" || !Array.isArray(plan.changes) || plan.changes.length === 0) {
    throw new Error(`Autofix planner declined this finding: ${String(plan.summary || plan.action || "no safe fix")}`);
  }

  const branch = `archic/autofix-${taskId.replaceAll("-", "").slice(0, 8)}`;
  await git(["fetch", "origin", baseRef]);
  await git(["checkout", "-B", branch, `origin/${baseRef}`]);

  const changedPaths = [];
  for (const change of plan.changes.slice(0, 4)) {
    const path = normalizedPath(change.path);
    if (!path || !safeChangePath(path, context.repositoryPaths) || typeof change.content !== "string") {
      throw new Error(`Autofix plan attempted an unsafe path: ${String(change.path)}`);
    }
    if (Buffer.byteLength(change.content, "utf8") > 80_000) throw new Error(`Autofix file exceeds 80 KB: ${path}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, change.content, "utf8");
    changedPaths.push(path);
  }

  if (!changedPaths.length) throw new Error("Autofix produced no writable changes");
  await git(["diff", "--check"]);
  await git(["add", "--", ...changedPaths]);
  const staged = (await git(["diff", "--cached", "--name-only"])).split("\n").filter(Boolean);
  if (!staged.length || staged.some((path) => !changedPaths.includes(path)) || staged.length !== new Set(changedPaths).size) {
    throw new Error("Autofix staged diff escaped the approved file set");
  }

  for (const script of ["lint", "typecheck", "test", "build", "test:e2e"]) await run(script);

  const worktree = await git(["status", "--porcelain=v1"]);
  const unexpected = worktree.split("\n").filter(Boolean).flatMap((line) => {
    const path = normalizedPath(line.slice(3).split(" -> ").at(-1));
    return path && !changedPaths.includes(path) ? [path] : [];
  });
  if (unexpected.length) throw new Error(`QA produced unexpected repository changes: ${unexpected.slice(0, 6).join(", ")}`);

  await git(["config", "user.name", "archic-control[bot]"]);
  await git(["config", "user.email", "archic-control[bot]@users.noreply.github.com"]);
  await git(["commit", "-m", `fix: Archic Control autofix ${taskId.slice(0, 8)}`]);
  const gitSha = await git(["rev-parse", "HEAD"]);
  await git(["push", "--force-with-lease", "origin", `HEAD:refs/heads/${branch}`]);

  const publication = await postJson(`/api/agents/tasks/${taskId}/autofix-publish`, {
    leaseToken: callbackToken,
    gitRef: branch,
    gitSha,
    summary: String(plan.summary || "Bounded Archic Control autofix."),
    changedFiles: changedPaths,
  });

  evidence.push({ check: "bounded-autofix", status: "passed", changedFiles: changedPaths.length });
  return {
    gitRef: branch,
    gitSha,
    summary: String(plan.summary || "Bounded Archic Control autofix."),
    changedFiles: changedPaths,
    pullRequestUrl: publication.pullRequestUrl,
  };
}

const started = Date.now();
let taskResult = {};
if (taskType === "quality") {
  for (const script of ["lint", "typecheck", "test", "build", "test:e2e"]) await run(script);
} else if (taskType === "autofix") {
  taskResult = await executeAutofix();
} else if (taskType === "playwright") {
  await run("test:e2e", true);
} else if (taskType === "smoke") {
  const baseUrl = input.baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) throw new Error("Smoke task requires an HTTPS baseUrl");
  const response = await fetch(baseUrl, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  const html = await response.text();
  evidence.push({ check: "https", status: response.ok ? "passed" : "failed", statusCode: response.status });
  evidence.push({ check: "html", status: /<title[^>]*>.+<\/title>/is.test(html) && html.length > 1_000 ? "passed" : "failed" });
  if (!evidence.every((item) => item.status === "passed")) throw new Error("Smoke checks failed");
  await run("archic:journeys");
} else {
  await run(`archic:${taskType}`, true);
}

await writeFile(".archic/task-result.json", JSON.stringify({
  checks: evidence,
  durationMs: Date.now() - started,
  gateStatus: taskType === "quality" ? "passed" : undefined,
  qualityStatus: taskType === "smoke" && scripts["archic:journeys"] ? "passed" : taskType === "smoke" ? "needs_evidence" : undefined,
  ...taskResult,
}, null, 2));
