import "server-only";

import { randomUUID } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";
import {
  evaluateQualityRubric,
  qualityReviewInputSchema,
  qualityRubricReportSchema,
  type QualityReviewInput,
  type QualityRubricReport,
} from "@/quality/rubric";

type Row = Record<string, unknown>;

function statusForRun(report: QualityRubricReport): "passed" | "failed" | "needs_evidence" {
  if (report.status === "CLIENT_READY" || report.status === "FLAGSHIP_READY") return "passed";
  if (report.status === "REJECT") return "failed";
  return "needs_evidence";
}

export async function ingestRubricReview(value: QualityReviewInput): Promise<QualityRubricReport> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required to persist an Archic rubric review");
  const input = qualityReviewInputSchema.parse(value);
  const report = evaluateQualityRubric(input);
  const sql = db();
  const projects = await sql.query(`select id from projects where id=$1 limit 1`, [input.projectId]);
  if (!projects.length) throw new Error("Project not found");

  const runId = randomUUID();
  const reviewedAt = report.reviewedAt;
  await sql.query(
    `insert into quality_runs(id,project_id,standard_version,source,status,raw_score,final_score,input,output,started_at,completed_at)
     values($1,$2,$3,'archic-rubric',$4,$5,$6,$7::jsonb,$8::jsonb,$9,$9)
     on conflict(project_id,source,started_at) do update set
       standard_version=excluded.standard_version,
       status=excluded.status,
       raw_score=excluded.raw_score,
       final_score=excluded.final_score,
       input=excluded.input,
       output=excluded.output,
       completed_at=excluded.completed_at`,
    [
      runId,
      input.projectId,
      `rubric-${report.rubricVersion}`,
      statusForRun(report),
      report.rawProjectScore,
      report.projectScore,
      JSON.stringify(input),
      JSON.stringify(report),
      reviewedAt,
    ],
  );

  await sql.query(
    `insert into audit_log(actor,action,entity_type,entity_id,metadata)
     values($1,'rubric_review_ingested','project',$2,$3::jsonb)`,
    [input.reviewer, input.projectId, JSON.stringify({ score: report.projectScore, level: report.archicLevel, status: report.status, rubricVersion: report.rubricVersion })],
  );

  return report;
}

export async function getLatestRubricReport(projectId: string): Promise<QualityRubricReport | null> {
  if (!hasDatabase()) return null;
  const rows = await db().query(
    `select output
     from quality_runs
     where project_id=$1 and source='archic-rubric'
     order by started_at desc
     limit 1`,
    [projectId],
  );
  const row = rows[0] as Row | undefined;
  if (!row?.output) return null;
  const parsed = qualityRubricReportSchema.safeParse(row.output);
  return parsed.success ? parsed.data : null;
}
