export const salesStages = [
  "found",
  "researched",
  "prototype",
  "contacted",
  "interested",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type SalesStage = (typeof salesStages)[number];
export type SalesOwner = "antero" | "vadim";

export const salesStageLabels: Record<SalesStage, string> = {
  found: "Encontrado",
  researched: "Investigado",
  prototype: "Prototipo",
  contacted: "Contactado",
  interested: "Interesado",
  meeting: "Reunión",
  proposal: "Propuesta",
  negotiation: "Negociación",
  won: "Ganado",
  lost: "Perdido",
};

export const salesOutcomes = [
  "no_answer",
  "call_later",
  "interested",
  "wants_proposal",
  "meeting",
  "not_interested",
  "won",
] as const;

export type SalesOutcome = (typeof salesOutcomes)[number];

export const salesOutcomeLabels: Record<SalesOutcome, string> = {
  no_answer: "No contestó",
  call_later: "Llamar más tarde",
  interested: "Interesado",
  wants_proposal: "Quiere propuesta",
  meeting: "Reunión",
  not_interested: "No interesado",
  won: "Cerrado",
};

export type SalesLead = {
  id: string;
  prospectId: string | null;
  name: string;
  city: string | null;
  category: string | null;
  stage: SalesStage;
  score: number | null;
  estimatedValue: number | null;
  quotedPrice: number | null;
  maintenanceMonthly: number | null;
  source: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  prototypeUrl: string | null;
  repositoryFullName: string | null;
  owner: SalesOwner;
  nextActionOwner: SalesOwner;
  nextAction: string | null;
  nextActionAt: string | null;
  lastContactAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SalesContact = {
  id: string;
  leadId: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SalesPipelineStage = {
  key: SalesStage;
  label: string;
  position: number;
  active: boolean;
  probability: number;
  terminal: boolean;
};

export const defaultPipelineStages: SalesPipelineStage[] = salesStages.map((key, index) => ({
  key,
  label: salesStageLabels[key],
  position: (index + 1) * 10,
  active: key !== "lost",
  probability: {
    found: 5,
    researched: 10,
    prototype: 20,
    contacted: 25,
    interested: 45,
    meeting: 60,
    proposal: 70,
    negotiation: 85,
    won: 100,
    lost: 0,
  }[key],
  terminal: key === "won" || key === "lost",
}));

export type SalesActivity = {
  id: string;
  leadId: string;
  type: "call" | "message" | "email" | "note" | "stage_change";
  outcome: SalesOutcome | null;
  note: string | null;
  actor: SalesOwner | "system";
  createdAt: string;
};

export type SalesData = {
  leads: SalesLead[];
  persistenceConfigured: boolean;
};
