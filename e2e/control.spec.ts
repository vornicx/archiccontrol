import { expect, test } from "@playwright/test";

async function openControl(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

test("Control abre directamente y muestra el límite de decisión", async ({ page }) => {
  await openControl(page);
  await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();
  await expect(page.getByText("Necesita a Vadim", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ratificar el Estándar de Calidad Archic v1.0" })).toBeVisible();
  await expect(page.getByText("La Bocana", { exact: true })).toBeVisible();
});

test("la prospección diaria admite flagships independientes el mismo día", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Prospección" }).click();
  await expect(page.getByRole("heading", { name: "Prospección diaria" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oportunidades cualificadas" })).toBeVisible();
  await expect(page.getByText("flagships objetivo al día", { exact: true })).toBeVisible();
});

test("el estándar de calidad y el control de proyecto son navegables", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Estándar de calidad" }).click();
  await expect(page.getByRole("heading", { name: "Estándar de Calidad Archic" })).toBeVisible();
  await expect(page.getByText("88").first()).toBeVisible();
  await page.getByRole("link", { name: "Proyectos" }).click();
  await page.getByRole("link", { name: /Marbella For Sale/ }).click();
  await expect(page.getByText("Sin bloqueos duros de calidad activos")).toBeVisible();
  await expect(page.getByText(/Too many mobile tap targets/).first()).toBeVisible();
});

test("el resumen móvil no tiene overflow horizontal", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "comprobación exclusiva de móvil");
  await openControl(page);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});

test("el endpoint de salud expone el estándar activo", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ ok: true, standardVersion: "1.0.0" });
});

test("la cola de agentes y la preparación de despliegues son visibles", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Agentes" }).click();
  await expect(page.getByRole("heading", { name: "Cola de agentes" })).toBeVisible();
  await expect(page.getByText("Política de reintentos")).toBeVisible();
  await page.getByRole("link", { name: "Despliegues" }).click();
  await expect(page.getByRole("heading", { name: "Vistas previas y despliegues" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preparación para producción" })).toBeVisible();
});
