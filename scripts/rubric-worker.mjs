const controlUrl = process.env.CONTROL_URL;
const taskId = process.env.TASK_ID;
const callbackToken = process.env.CALLBACK_TOKEN;
const input = JSON.parse(process.env.TASK_INPUT || "{}");
const externalUrl = process.env.EXTERNAL_URL || null;

if (!controlUrl || !taskId || !callbackToken) throw new Error("Central rubric worker environment is incomplete");

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

function pathPriority(path) {
  if (path === "/") return 1_000;
  let score = 0;
  if (/(book|booking|reserve|reservation|reservas|contact|enquir|checkout|cart)/i.test(path)) score += 180;
  if (/(propert|homes|listing|fleet|cars|vehicles|models|yacht|rooms|suites|shop|catalog|menu|carta)/i.test(path)) score += 140;
  if (/(about|story|historia|experience|services|servicios|dining|restaurant|locations|areas|destinations)/i.test(path)) score += 80;
  score -= Math.max(0, path.split("/").filter(Boolean).length - 2) * 12;
  return score;
}

function selectReviewPaths(baseUrl, discoveredLinks) {
  const requested = Array.isArray(input.pages) ? input.pages.map((page) => typeof page === "string" ? page : page?.path) : [];
  return Array.from(new Set(["/", ...requested, ...discoveredLinks]
    .map((value) => cleanReviewPath(value, baseUrl))
    .filter(Boolean)))
    .sort((a, b) => pathPriority(b) - pathPriority(a) || a.localeCompare(b))
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

async function captureViewport(browser, baseUrl, path, viewport) {
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
  const dom = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    return {
      title: document.title.slice(0, 500),
      bodyText: normalize(document.body?.innerText || "").slice(0, 20_000),
      headings: Array.from(document.querySelectorAll("h1,h2,h3")).map((node) => normalize(node.textContent)).filter(Boolean).slice(0, 80),
      links: Array.from(document.querySelectorAll("a[href]")).map((node) => ({ text: normalize(node.textContent).slice(0, 300), href: node.href })).filter((link) => link.href).slice(0, 160),
      brokenImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src || image.alt || "broken-image").slice(0, 40),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });
  await context.close();
  return { imageBase64, dom, consoleErrors };
}

async function captureEvidence(baseUrl) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const home = await captureViewport(browser, baseUrl, "/", { width: 1440, height: 900 });
    const paths = selectReviewPaths(baseUrl, home.dom.links.map((link) => link.href));
    const pages = [];
    for (const path of paths) {
      const desktop = path === "/" ? home : await captureViewport(browser, baseUrl, path, { width: 1440, height: 900 });
      const mobile = await captureViewport(browser, baseUrl, path, { width: 390, height: 844 });
      pages.push({
        path,
        title: desktop.dom.title,
        bodyText: desktop.dom.bodyText,
        headings: desktop.dom.headings,
        links: desktop.dom.links,
        brokenImages: Array.from(new Set([...desktop.dom.brokenImages, ...mobile.dom.brokenImages])).slice(0, 40),
        consoleErrors: Array.from(new Set([...desktop.consoleErrors, ...mobile.consoleErrors])).slice(0, 30),
        overflowX: desktop.dom.overflowX || mobile.dom.overflowX,
        desktopImageBase64: desktop.imageBase64,
        mobileImageBase64: mobile.imageBase64,
      });
    }
    return pages;
  } finally {
    await browser.close();
  }
}

async function complete(outcome, result, error) {
  return postJson(`/api/agents/tasks/${taskId}/complete`, {
    leaseToken: callbackToken,
    outcome,
    result,
    ...(error ? { error } : {}),
  });
}

const baseUrl = input.baseUrl;
if (typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) throw new Error("Rubric task requires an HTTPS baseUrl");

try {
  await postJson(`/api/agents/tasks/${taskId}/start`, { leaseToken: callbackToken, externalUrl });
  const pages = await captureEvidence(baseUrl);
  if (!pages.length) throw new Error("Rubric worker captured no reviewable pages");
  const payload = await postJson(`/api/agents/tasks/${taskId}/rubric-review`, { leaseToken: callbackToken, pages }, 118_000);
  if (!payload.report || typeof payload.report !== "object") throw new Error("Rubric reviewer returned no persisted report");
  await complete("succeeded", {
    checks: [{ check: "archic-rubric", status: "passed", pages: pages.length, score: payload.report.projectScore, rubricStatus: payload.report.status }],
    rubricVersion: payload.report.rubricVersion,
    archicScore: payload.report.projectScore,
    archicLevel: payload.report.archicLevel,
    rubricStatus: payload.report.status,
    mobileScore: payload.report.mobileScore,
    totalSlopPenalty: payload.report.totalSlopPenalty,
    highSlopFindings: payload.report.highSlopFindings,
    reviewedPages: pages.map((page) => page.path),
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await complete("failed", {}, message.slice(0, 2_000));
  } catch {
    // Keep the original worker failure as the workflow failure.
  }
  throw error;
}
