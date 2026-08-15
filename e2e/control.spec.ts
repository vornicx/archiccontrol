import { expect, test } from "@playwright/test";

async function openControl(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

test("Control opens directly and exposes the decision boundary", async ({ page }) => {
  await openControl(page);
  await expect(page.getByRole("heading", { name: "Operating overview" })).toBeVisible();
  await expect(page.getByText("Needs Vadim", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ratify Archic Quality Standard v1.0" })).toBeVisible();
  await expect(page.getByText("La Bocana", { exact: true })).toBeVisible();
});

test("daily prospecting is a first-class Control surface", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Prospects" }).click();
  await expect(page.getByRole("heading", { name: "Daily prospecting" })).toBeVisible();
  await expect(page.getByText("Verified operating status")).toBeVisible();
  await expect(page.getByText("One prototype per day")).toBeVisible();
});

test("quality standard and a project gate are fully navigable", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Quality Standard" }).click();
  await expect(page.getByRole("heading", { name: "Archic Quality Standard" })).toBeVisible();
  await expect(page.getByText("88").first()).toBeVisible();
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: /Marbella For Sale/ }).click();
  await expect(page.getByText("No active hard quality gates")).toBeVisible();
  await expect(page.getByText(/Too many mobile tap targets/).first()).toBeVisible();
});

test("mobile overview has no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "mobile-only assertion");
  await openControl(page);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("health endpoint exposes the active standard", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ ok: true, standardVersion: "1.0.0" });
});

test("agent queue and deployment readiness are visible", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Agents" }).click();
  await expect(page.getByRole("heading", { name: "Agent queue" })).toBeVisible();
  await expect(page.getByText("Retry policy")).toBeVisible();
  await page.getByRole("link", { name: "Deployments" }).click();
  await expect(page.getByRole("heading", { name: "Previews & deployments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Production readiness" })).toBeVisible();
});
