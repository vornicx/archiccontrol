import type { ProspectRecord } from "@/prospecting/types";

export interface ProspectOpportunityEstimate {
  amount: number;
  minimum: number;
  maximum: number;
  rationale: string;
  factors: string[];
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("es");
}

function roundTo50(value: number): number {
  return Math.max(0, Math.round(value / 50) * 50);
}

function categoryBase(category: string): { value: number; label: string } {
  if (/inmobili|real estate|property|estate/.test(category)) return { value: 1800, label: "inmobiliaria" };
  if (/renting|rent a car|rental|alquiler.*coche|car rental|charter|boat|yacht/.test(category)) return { value: 1400, label: "alquiler premium" };
  if (/e-?commerce|tienda|retail|mueble|silla|catalog/.test(category)) return { value: 1150, label: "catálogo / e-commerce" };
  if (/clinic|clínica|asesor|abog|consult|professional|servicio profesional/.test(category)) return { value: 1050, label: "servicio profesional" };
  if (/restaurant|restaurante|café|cafe|barber|barbería|peluquer|hosteler/.test(category)) return { value: 750, label: "negocio local" };
  return { value: 850, label: "negocio general" };
}

function researchServices(prospect: ProspectRecord): string[] {
  const services = prospect.research.services;
  return Array.isArray(services) ? services.map((item) => normalized(item)).filter(Boolean) : [];
}

export function estimateProspectOpportunity(prospect: ProspectRecord): ProspectOpportunityEstimate {
  const category = normalized(prospect.category || prospect.research.category);
  const base = categoryBase(category);
  const score = Math.min(100, Math.max(0, Number(prospect.score ?? 55)));
  const scoreFactor = 0.78 + (score / 100) * 0.52;
  const confidenceFactor = prospect.verificationConfidence === "high" ? 1.06 : prospect.verificationConfidence === "medium" ? 0.98 : 0.88;
  const services = researchServices(prospect);
  const gap = normalized(prospect.research.websiteGap || prospect.research.salesAngle || prospect.research.fitReason);
  const combined = `${services.join(" ")} ${gap}`;

  let complexity = 0;
  const factors: string[] = [`base ${base.label}`];

  const complexitySignals: Array<[RegExp, number, string]> = [
    [/reserv|booking|cita|calendar/, 220, "reservas / agenda"],
    [/crm|panel|dashboard|owner|admin|gestión|gestion/, 300, "panel o gestión"],
    [/e-?commerce|stripe|checkout|pago|tienda/, 320, "venta online"],
    [/catalog|catálogo|catalogo|inventory|inventario|fleet|flota|properties|propiedades/, 220, "catálogo dinámico"],
    [/multi.*lang|idioma|english|español|ingles|inglés/, 120, "multidioma"],
  ];

  for (const [pattern, value, label] of complexitySignals) {
    if (!pattern.test(combined)) continue;
    complexity += value;
    factors.push(label);
  }
  complexity = Math.min(complexity, 850);

  let opportunityBonus = 0;
  if (/no (website|web)|sin web|broken|roto|no funciona|outdated|desactual|poor|débil|debil/.test(gap)) {
    opportunityBonus += 180;
    factors.push("brecha digital clara");
  }
  if (prospect.evidence.length >= 3) {
    opportunityBonus += 80;
    factors.push("evidencia sólida");
  }

  const raw = (base.value + complexity + opportunityBonus) * scoreFactor * confidenceFactor;
  const amount = Math.min(6000, Math.max(350, roundTo50(raw)));
  const minimum = Math.max(300, roundTo50(amount * 0.82));
  const maximum = Math.min(7500, roundTo50(amount * 1.28));
  factors.push(`score ${Math.round(score)}/100`);
  factors.push(`confianza ${prospect.verificationConfidence}`);

  return {
    amount,
    minimum,
    maximum,
    factors,
    rationale: `Estimación interna basada en ${factors.join(", ")}. No sustituye el precio que decidáis comercialmente.`,
  };
}
