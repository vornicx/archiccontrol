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
const githubToken = process.env.GITHUB_TOKEN;
const repositoryFullName = process.env.GITHUB_REPOSITORY;
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

async function github(path, init = {}) {
  if (!githubToken || !repositoryFullName) throw new Error("GitHub Actions repository token is unavailable");
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "archic-control-worker/1.0",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? payload.message || JSON.stringify(payload).slice(0, 500) : "request failed";
    throw new Error(`GitHub ${response.status} ${path}: ${detail}`);
  }
  return payload;
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

async function postJson(path, body, timeoutMs = 60_000) {
  const response = await fetch(`${controlUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
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

async function ensureDraftPullRequest(branch, gitSha, summary, changedPaths) {
  if (!repositoryFullName) throw new Error("GITHUB_REPOSITORY is unavailable");
  const owner = repositoryFullName.split("/")[0];
  const existing = await github(
    `/repos/${repositoryFullName}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(baseRef)}`,
  );
  if (Array.isArray(existing) && existing[0]?.html_url) return existing[0].html_url;

  const titleSource = String(input.summary || input.finding?.id || "quality finding").slice(0, 180);
  const body = [
    "## Archic Control autofix",
    "",
    `Task: \`${taskId}\``,
    `Commit: \`${gitSha}\``,
    "",
    summary,
    "",
    "### Changed files",
    ...changedPaths.map((path) => `- \`${path}\``),
    "",
    "### Safety boundary",
    "This draft PR was generated from one verified quality finding. The planner was limited to repository-provided file contents, blocked from secrets, CI, deployment configuration, dependencies and database files, and capped at four changed files.",
    "",
    "The finding remains in `fixing` until a later benchmark run independently verifies that the defect disappeared.",
  ].join("\n");

  const pull = await github(`/repos/${repositoryFullName}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `fix: ${titleSource}`,
      body,
      head: branch,
      base: baseRef,
      draft: true,
      maintainer_can_modify: true,
    }),
  });
  if (!pull?.html_url) throw new Error("GitHub did not return a pull request URL");
  return pull.html_url;
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

  const summary = String(plan.summary || "Bounded Archic Control autofix.");
  const pullRequestUrl = await ensureDraftPullRequest(branch, gitSha, summary, changedPaths);

  evidence.push({ check: "bounded-autofix", status: "passed", changedFiles: changedPaths.length });
  return {
    gitRef: branch,
    gitSha,
    summary,
    changedFiles: changedPaths,
    pullRequestUrl,
  };
}

function cleanReviewPath(value, baseUrl) {
  try {
    const url = new URL(String(value || ""), baseUrl);
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) return null;
    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith("/") || path.length > 300) return null;
    if (/\.(?:jpg|jpeg|png|webp|svg|gif|pdf|zip|mp4|webm|ico)$/i.test(url.pathname)) return null;
    if (/(privacy|privacidad|legal|cookie|terms|terminos|login|sign-in|signin|admin|studio|owner|auth)/i.test(url.pathname)) return null;
    return path || "/";
  } catch {
    return null;
  }
}

function reviewPathPriority(path) {
  if (path === "/") return 1000;
  let score = 0;
  if (/(book|booking|reserve|reservation|reservas|contact|enquir|checkout|cart)/i.test(path)) score += 180;
  if (/(propert|homes|listing|fleet|cars|vehicles|models|yacht|rooms|suites|shop|catalog|menu|carta)/i.test(path)) score += 140;
  if (/(about|story|historia|experience|services|servicios|dining|restaurant|locations|areas|destinations)/i.test(path)) score += 80;
  score -= Math.max(0, path.split("/").filter(Boolean).length - 2) * 12;
  return score;
}

function selectReviewPaths(baseUrl, discoveredLinks) {
  const requested = Array.isArray(input.pages) ? input.pages.map((page) => typeof page === "string" ? page : page?.path) : [];
  const candidates = ["/", ...requested, ...discoveredLinks]
    .map((value) => cleanReviewPath(value, baseUrl))
    .filter(Boolean);
  return Array.from(new Set(candidates))
    .sort((a, b) => reviewPathPriority(b) - reviewPathPriority(a) || a.localeCompare(b))
    .slice(0, 4);
}

async function encodeScreenshot(page, fullPage) {
  for (const quality of [42, 32, 24]) {
    const buffer = await page.screenshot({ type: "jpeg", quality, fullPage, animations: "disabled" });
    if (buffer.byteLength <= 300_000) return buffer.toString("base64");
  }
  const fallback = await page.screenshot({ type: "jpeg", quality: 20, fullPage: false, animations: "disabled" });
  if (fallback.byteLength > 310_000) throw new Error("Rubric screenshot exceeds safe request budget");
  return fallback.toString("base64");
}

async function captureViewport(browser, baseUrl, path, viewport, collectDom) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && consoleErrors.length < 30) consoleErrors.push(message.text().slice(0, 1_000));
  });
  page.on("pageerror", (error) => {
    if (consoleErrors.length < 30) consoleErrors.push(String(error.message || error).slice(0, 1_000));
  });
  const url = new URL(path, baseUrl).toString();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!response || response.status() >= 400) throw new Error(`Rubric capture failed ${response?.status() ?? "no-response"} ${url}`);
  await page.waitForTimeout(1_200);
  const imageBase64 = await encodeScreenshot(page, true);
  let dom = null;
  if (collectDom) {
    dom = await page.evaluate(() => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const bodyText = normalize(document.body?.innerText || "").slice(0, 20_000);
      const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
        .map((node) => normalize(node.textContent))
        .filter(Boolean)
        .slice(0, 80);
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((node) => ({ text: normalize(node.textContent).slice(0, 300), href: node.href }))
        .filter((link) => link.href)
        .slice(0, 160);
      const brokenImages = Array.from(document.images)
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || image.alt || "broken-image")
        .slice(0, 40);
      return {
        title: document.title.slice(0, 500),
        bodyText,
        headings,
        links,
        brokenImages,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });
  }
  await context.close();
  return { imageBase64, dom, consoleErrors };
}

async function captureRubricEvidence(baseUrl) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const home = await captureViewport(browser, baseUrl, "/", { width: 1440, height: 900 }, true);
    const discovered = (home.dom?.links || []).map((link) => link.href);
    const paths = selectReviewPaths(baseUrl, discovered);
    const pages = [];
    for (const path of paths) {
      const desktop = path === "/" ? home : await captureViewport(browser, baseUrl, path, { width: 1440, height: 900 }, true);
      const mobile = await captureViewport(browser, baseUrl, path, { width: 390, height: 844 }, true);
      const dom = desktop.dom;
      const mobileDom = mobile.dom;
      if (!dom || !mobileDom) continue;
      pages.push({
        path,
        title: dom.title,
        bodyText: dom.bodyText,
        headings: dom.headings,
        links: dom.links.map((link) => ({ text: link.text, href: link.href })),
        brokenImages: Array.from(new Set([...dom.brokenImages, ...mobileDom.brokenImages])).slice(0, 40),
        consoleErrors: Array.from(new Set([...desktop.consoleErrors, ...mobile.consoleErrors])).slice(0, 30),
        overflowX: dom.overflowX || mobileDom.overflowX,
        desktopImageBase64: desktop.imageBase64,
        mobileImageBase64: mobile.imageBase64,
      });
    }
    return pages;
  } finally {
    await browser.close();
  }
}

async function executeRubricReview() {
  const baseUrl = input.baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) throw new Error("Rubric task requires an HTTPS baseUrl");
  const pages = await captureRubricEvidence(baseUrl);
  if (!pages.length) throw new Error("Rubric worker captured no reviewable pages");
  const payload = await postJson(`/api/agents/tasks/${taskId}/rubric-review`, { leaseToken: callbackToken, pages }, 118_000);
  if (!payload.report || typeof payload.report !== "object") throw new Error("Rubric reviewer returned no persisted report");
  evidence.push({ check: "archic-rubric", status: "passed", pages: pages.length, score: payload.report.projectScore, rubricStatus: payload.report.status });
  return {
    rubricVersion: payload.report.rubricVersion,
    archicScore: payload.report.projectScore,
    archicLevel: payload.report.archicLevel,
    rubricStatus: payload.report.status,
    mobileScore: payload.report.mobileScore,
    totalSlopPenalty: payload.report.totalSlopPenalty,
    highSlopFindings: payload.report.highSlopFindings,
    reviewedPages: pages.map((page) => page.path),
  };
}

const started = Date.now();
let taskResult = {};
if (taskType === "quality") {
  for (const script of ["lint", "typecheck", "test", "build", "test:e2e"]) await run(script);
} else if (taskType === "autofix") {
  taskResult = await executeAutofix();
} else if (taskType === "rubric") {
  taskResult = await executeRubricReview();
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
