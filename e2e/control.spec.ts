import { expect, test } from "@playwright/test";

async function openControl(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

test("Control abre directamente y muestra el centro de mando", async ({ page }) => {
  await openControl(page);
  await expect(page.getByRole("heading", { name: "Hoy en Archic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decisiones que sí necesitan criterio humano" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ratificar el Estándar de Calidad Archic v1.0" })).toBeVisible();
  await expect(page.getByText("La Bocana", { exact: true })).toBeVisible();
  await expect(page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).resolves.toBe("light");
});

test("la prospección diaria separa estimación automática y decisión comercial", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Prospectos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prospección diaria" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oportunidades cualificadas" })).toBeVisible();
  await expect(page.getByText("Estimación Control", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Potencial elegido", { exact: true })).toBeVisible();
  await expect(page.getByText(/3 flagships objetivo al día/)).toBeVisible();
});

test("el CRM funciona como espacio comercial operativo dentro de Control", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "CRM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(page.getByText("Pipeline abierto", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nuevo prospecto/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "Oportunidades", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Oportunidades", exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar oportunidades")).toBeVisible();
  await expect(page.getByLabel("Filtrar por responsable")).toBeVisible();

  await page.getByRole("link", { name: /Nuevo prospecto/ }).first().click();
  await expect(page.getByRole("heading", { name: "Nuevo prospecto", exact: true })).toBeVisible();
  await expect(page.getByLabel("Nombre del negocio")).toBeVisible();
  await expect(page.getByLabel("Presupuesto enviado")).toBeVisible();
  await expect(page.getByLabel("Mantenimiento mensual")).toBeVisible();

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurar etapas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Configurar etapas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByText("Nombre visible", { exact: true }).first()).toBeVisible();
});

test("el estándar de calidad y la rúbrica ejecutable son navegables", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Calidad", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estándar de Calidad Archic" })).toBeVisible();
  await expect(page.getByText("88").first()).toBeVisible();
  await expect(page.getByText("50").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Criterio Archic ejecutable, separado del benchmark." })).toBeVisible();
  await expect(page.getByText("Atmosphere", { exact: true })).toBeVisible();
  await expect(page.getByText("Hard gates G01–G10", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Proyectos", exact: true }).click();
  await page.getByRole("link", { name: /Marbella For Sale/ }).click();
  await expect(page.getByText("Sin bloqueos duros de calidad activos")).toBeVisible();
  await expect(page.getByText("Archic Score", { exact: true })).toBeVisible();
  await expect(page.getByText(/Falta la revisión Archic/)).toBeVisible();
  await expect(page.getByText(/Too many mobile tap targets/).first()).toBeVisible();
});

test("todas las vistas principales móviles comparten shell claro y no tienen overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "comprobación exclusiva de móvil");
  await openControl(page);
  const paths = [
    "/",
    "/decisions",
    "/prospects",
    "/sales",
    "/sales/opportunities",
    "/projects",
    "/quality",
    "/automation",
    "/deployments",
    "/runs",
    "/settings",
  ];

  for (const path of paths) {
    await page.goto(path);
    const state = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth);
    expect(state.colorScheme).toBe("light");
  }

  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});

test("el endpoint de salud expone el estándar y la rúbrica activos", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ ok: true, standardVersion: "1.0.0", rubricVersion: "1.0" });
});

test("la cola de automatización y la preparación de despliegues son visibles", async ({ page }) => {
  await openControl(page);
  await page.getByRole("link", { name: "Automatización", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cola de agentes" })).toBeVisible();
  await expect(page.getByText("Política de reintentos")).toBeVisible();
  await page.getByRole("link", { name: "Despliegues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vistas previas y despliegues" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preparación para producción" })).toBeVisible();
});
