import "server-only";
import { db, hasDatabase } from "@/lib/db";
import type { ProspectRecord, ProspectingData, ResearchCandidate } from "@/prospecting/types";

type Row = Record<string, unknown>;

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? new Date(0).toISOString());
}

function asDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "");
  const isoPrefix = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoPrefix) return isoPrefix;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function mapProspect(row: Row): ProspectRecord {
  return {
    id: String(row.id),
    runDate: asDateKey(row.run_date),
    name: String(row.name),
    city: row.city == null ? null : String(row.city),
    category: row.category == null ? null : String(row.category),
    websiteUrl: row.website_url == null ? null : String(row.website_url),
    socialUrl: row.social_url == null ? null : String(row.social_url),
    status: row.status as ProspectRecord["status"],
    score: row.score == null ? null : Number(row.score),
    verificationConfidence: row.verification_confidence as ProspectRecord["verificationConfidence"],
    evidence: asJson(row.evidence, []),
    research: asJson(row.research, {}),
    price: asJson(row.price, {}),
    outreach: asJson(row.outreach, {}),
    repositoryFullName: row.repository_full_name == null ? null : String(row.repository_full_name),
    deploymentUrl: row.deployment_url == null ? null : String(row.deployment_url),
    error: row.error == null ? null : String(row.error),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export async function getProspectingData(): Promise<ProspectingData> {
  if (!hasDatabase()) return { today: null, todayProspects: [], recent: [], persistenceConfigured: false };
  const rows = await db().query(`
    select *
    from prospects
    order by run_date desc, score desc nulls last, created_at asc
    limit 60
  `) as Row[];
  const recent = rows.map(mapProspect);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayProspects = recent.filter((item) => item.runDate === todayKey);
  return { today: todayProspects[0] ?? null, todayProspects, recent, persistenceConfigured: true };
}

export async function hasProspectingRun(runDate: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const rows = await db().query(`select id from prospects where run_date=$1::date limit 1`, [runDate]) as Row[];
  return rows.length > 0;
}

export async function knownBusinessNames(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await db().query(`
    select name from projects
    union
    select name from prospects
    order by name
  `) as Row[];
  return rows.map((row) => String(row.name)).filter(Boolean);
}

export async function saveProspect(input: {
  id: string;
  runDate: string;
  candidate: Partial<ResearchCandidate>;
  status: ProspectRecord["status"];
  confidence: ProspectRecord["verificationConfidence"];
  evidence?: unknown[];
  repositoryFullName?: string | null;
  deploymentUrl?: string | null;
  error?: string | null;
}): Promise<void> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required to persist prospecting runs");
  const candidate = input.candidate;
  await db().query(`
    insert into prospects(
      id,run_date,name,city,category,website_url,social_url,status,score,verification_confidence,
      evidence,research,price,outreach,repository_full_name,deployment_url,error
    ) values(
      $1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,
      $11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17
    )
    on conflict(id) do update set
      run_date=excluded.run_date,
      name=excluded.name,
      city=excluded.city,
      category=excluded.category,
      website_url=excluded.website_url,
      social_url=excluded.social_url,
      status=excluded.status,
      score=excluded.score,
      verification_confidence=excluded.verification_confidence,
      evidence=excluded.evidence,
      research=excluded.research,
      price=excluded.price,
      outreach=excluded.outreach,
      repository_full_name=excluded.repository_full_name,
      deployment_url=excluded.deployment_url,
      error=excluded.error,
      updated_at=now()
  `, [
    input.id,
    input.runDate,
    candidate.name || "No qualified prospect",
    candidate.city ?? null,
    candidate.category ?? null,
    candidate.websiteUrl ?? null,
    candidate.socialUrl ?? null,
    input.status,
    candidate.score ?? null,
    input.confidence,
    JSON.stringify(input.evidence ?? candidate.evidence ?? []),
    JSON.stringify(candidate),
    JSON.stringify(candidate.price ?? {}),
    JSON.stringify({ message: candidate.outreachMessage ?? "" }),
    input.repositoryFullName ?? null,
    input.deploymentUrl ?? null,
    input.error ?? null,
  ]);
}

export async function createProspectDecision(input: {
  id: string;
  title: string;
  context: string;
  recommendation: string;
  risk: string;
}): Promise<void> {
  if (!hasDatabase()) return;
  await db().query(`
    insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
    values($1,null,'final_approval',$2,$3,$4,$5,'pending',false,'daily-prospecting')
    on conflict(id) do nothing
  `, [input.id, input.title, input.context, input.recommendation, input.risk]);
}
