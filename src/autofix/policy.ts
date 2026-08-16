export type AutofixAction = "apply" | "need_files" | "cannot_fix";

export interface AutofixChange {
  path: string;
  content: string;
  reason: string;
}

export interface AutofixPlan {
  action: AutofixAction;
  summary: string;
  confidence: "high" | "medium" | "low";
  requestedPaths: string[];
  changes: AutofixChange[];
}

const BLOCKED_EXACT = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "vercel.json",
]);

const BLOCKED_PREFIXES = [
  ".git/",
  ".github/",
  ".archic/",
  "node_modules/",
  "db/",
];

const EDITABLE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html|mdx?|json|txt|xml)$/i;
const SAFE_NEW_ROOT_FILES = new Set(["robots.txt", "sitemap.xml"]);

export function normalizeAutofixPath(value: string): string | null {
  const path = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

export function isSensitiveAutofixPath(value: string): boolean {
  const path = normalizeAutofixPath(value);
  if (!path) return true;
  const lower = path.toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return true;
  if (BLOCKED_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  if (lower === ".env" || lower.startsWith(".env.")) return true;
  if (lower.includes("secret") || lower.includes("credential")) return true;
  return false;
}

export function isAutofixContextPath(value: string): boolean {
  const path = normalizeAutofixPath(value);
  if (!path || isSensitiveAutofixPath(path)) return false;
  if (path === "package.json") return true;
  return EDITABLE_EXTENSIONS.test(path);
}

export function isSafeNewAutofixPath(value: string): boolean {
  const path = normalizeAutofixPath(value);
  if (!path || isSensitiveAutofixPath(path) || !EDITABLE_EXTENSIONS.test(path)) return false;
  if (SAFE_NEW_ROOT_FILES.has(path)) return true;
  return path.startsWith("src/") || path.startsWith("app/") || path.startsWith("public/");
}

export function sanitizeAutofixPlan(
  plan: AutofixPlan,
  contextPaths: Iterable<string>,
  repositoryPaths: Iterable<string>,
): AutofixPlan {
  const context = new Set(Array.from(contextPaths, (path) => normalizeAutofixPath(path)).filter((path): path is string => Boolean(path)));
  const repository = new Set(Array.from(repositoryPaths, (path) => normalizeAutofixPath(path)).filter((path): path is string => Boolean(path)));
  const requestedPaths = Array.from(new Set(plan.requestedPaths.map(normalizeAutofixPath).filter((path): path is string => Boolean(path))))
    .filter((path) => repository.has(path) && isAutofixContextPath(path))
    .slice(0, 6);

  if (plan.action !== "apply") {
    return { ...plan, requestedPaths, changes: [] };
  }

  const seen = new Set<string>();
  const changes: AutofixChange[] = [];
  let totalBytes = 0;
  for (const change of plan.changes) {
    const path = normalizeAutofixPath(change.path);
    if (!path || seen.has(path) || isSensitiveAutofixPath(path) || path === "package.json") continue;
    const exists = repository.has(path);
    if (exists && !context.has(path)) continue;
    if (!exists && !isSafeNewAutofixPath(path)) continue;
    if (!EDITABLE_EXTENSIONS.test(path)) continue;
    const bytes = Buffer.byteLength(change.content, "utf8");
    if (bytes === 0 || bytes > 80_000 || totalBytes + bytes > 180_000) continue;
    seen.add(path);
    totalBytes += bytes;
    changes.push({ path, content: change.content, reason: change.reason.slice(0, 500) });
    if (changes.length >= 4) break;
  }

  return {
    ...plan,
    requestedPaths: [],
    changes,
    action: changes.length ? "apply" : "cannot_fix",
    summary: changes.length ? plan.summary : `${plan.summary} No policy-compliant file changes were produced.`.slice(0, 1_000),
  };
}
