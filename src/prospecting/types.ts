export type ProspectEvidenceKind = "official_site" | "social_recent" | "booking" | "map_listing" | "press" | "directory" | "other";
export type ProspectStatus = "researching" | "verified" | "ready" | "discarded" | "blocked";

export interface ProspectEvidence {
  sourceName: string;
  url: string;
  kind: ProspectEvidenceKind;
  observedAt: string | null;
  detail: string;
  reachable?: boolean;
}

export interface ProspectContact {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  bestMethod?: string | null;
}

export interface ProspectContactPerson {
  name: string;
  role: string | null;
  sourceUrl?: string | null;
  verified: boolean;
}

export interface ProspectEstimatedValue {
  currency: "EUR";
  amount: number;
  rationale: string;
  closeProbability?: number | null;
}

export interface ProspectPrice {
  currency: "EUR";
  minimum: number;
  target: number;
  maximum: number;
  maintenanceMonthly: number | null;
  rationale: string;
}

export interface ProspectCopy {
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  storyTitle: string;
  storyBody: string;
  ctaLabel: string;
}

export interface ResearchCandidate {
  name: string;
  city: string;
  category: string;
  websiteUrl: string;
  socialUrl: string | null;
  summary: string;
  fitReason: string;
  websiteGap: string;
  score: number;
  services: string[];
  contact: ProspectContact;
  contactPerson?: ProspectContactPerson;
  bestContactMethod?: string | null;
  estimatedValue?: ProspectEstimatedValue;
  price: ProspectPrice;
  outreachMessage: string;
  copy: ProspectCopy;
  evidence: ProspectEvidence[];
  closureContradiction: boolean;
  closureDetail: string | null;
}

export interface ProspectRecord {
  id: string;
  runDate: string;
  name: string;
  city: string | null;
  category: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  status: ProspectStatus;
  score: number | null;
  verificationConfidence: "unverified" | "medium" | "high";
  evidence: ProspectEvidence[];
  research: Partial<ResearchCandidate> & Record<string, unknown>;
  price: Partial<ProspectPrice> & Record<string, unknown>;
  outreach: { message?: string } & Record<string, unknown>;
  repositoryFullName: string | null;
  deploymentUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectingData {
  /** Highest-scoring prospect for compatibility with existing consumers. */
  today: ProspectRecord | null;
  /** Every independently persisted prospect for the current Madrid date. */
  todayProspects: ProspectRecord[];
  recent: ProspectRecord[];
  persistenceConfigured: boolean;
}

export interface ProspectingRunResult {
  status: "ready" | "discarded" | "blocked" | "already_ran" | "not_configured";
  runDate: string;
  prospectId?: string;
  name?: string;
  repositoryFullName?: string;
  deploymentUrl?: string;
  reason?: string;
}
