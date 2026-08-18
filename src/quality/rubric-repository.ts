import "server-only";

import { randomUUID } from "node:crypto";
import { enqueueTask } from "@/lib/automation-repository";
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

function repairCandidates(report: QualityRubricReport): string[] {
  const candidates = [
    ...report.topFixes,
    ...report.hardGateFailures.map((failure) => `${failure.name}: ${failure.evidence}`),
    ...report.sectionFailures.map((failure) => `${failure.label} on ${failure.path} scores ${failure.score}/${failure.required}; rebuild the section around purpose, specificity, hierarchy, composition and handoff.`),
    ...report.slopFindings.filter((finding) => finding.severity === "high").map((finding) => `${finding.signalId} ${finding.label} on ${finding.path}: ${finding.evidence}`),
  ];
  return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))).slice(0, 3);
}

async function supersedePreviousRubricWork(projectId: string): Promise<void> {
  const sql = db();
  const rows = await sql.query(
    `select id from findings
     where project_id=$1 and source='rubric' and status in ('open','fixing','blocked')`,
    [projectId],
  );
  const ids = (rows as Row[]).map((row) => String(row.id));
  if (!ids.length) return;
  await sql.query(`update findings set status='resolved' where id=any($1::text[])`, [ids]);
  await sql.query(
    `update agent_tasks
     set status='cancelled', completed_at=coalesce(completed_at,now()), lease_owner=null, lease_token_hash=null, leased_until=null,
         last_error='Superseded by a newer Archic rubric review.'
     where finding_id=any($1::text[]) and status in ('queued','dispatched','leased','running')`,
    [ids],
  );
}

export async function ingestRubricReview(value: QualityReviewInput): Promise<QualityRubricReport> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required to persist an Archic rubric review");
  const input = qualityReviewInputSchema.parse(value);
  const report = evaluateQualityRubric(input);
  const sql = db();
  const projects = await sql.query(`select id from projects where id=$1 limit 1`, [input.projectId]);
  if (!projects.length) throw new Error("Project not found");

  const proposedRunId = randomUUID();
  const reviewedAt = report.reviewedAt;
  const runRows = await sql.query(
    `insert into quality_runs(id,project_id,standard_version,source,status,raw_score,final_score,input,output,started_at,completed_at)
     values($1,$2,$3,'archic-rubric',$4,$5,$6,$7::jsonb,$8::jsonb,$9,$9)
     on conflict(project_id,source,started_at) do update set
       standard_version=excluded.standard_version,
       status=excluded.status,
       raw_score=excluded.raw_score,
       final_score=excluded.final_score,
       input=excluded.input,
       output=excluded.output,
       completed_at=excluded.completed_at
     returning id`,
    [
      proposedRunId,
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
  const runId = runRows[0]?.id ? String(runRows[0].id) : proposedRunId;

  await supersedePreviousRubricWork(input.projectId);
  const automaticReviewer = input.reviewer === "archic-vision-reviewer";
  if (automaticReviewer && report.status !== "CLIENT_READY" && report.status !== "FLAGSHIP_READY") {
    const fixes = repairCandidates(report);
    for (const [index, fix] of fixes.entries()) {
      const findingId = `${input.projectId}:rubric:${runId}:${index + 1}`;
      const severity = report.status === "REJECT" || (index === 0 && report.highSlopFindings > 0) ? "high" : "medium";
      await sql.query(
        `insert into findings(id,run_id,project_id,check_id,source,severity,status,title,detail,evidence,automation_action,owner_type)
         values($1,$2,$3,$4,'rubric',$5,'open',$6,$7,$8::jsonb,$7,'agent')
         on conflict(id) do update set severity=excluded.severity,status='open',title=excluded.title,detail=excluded.detail,evidence=excluded.evidence,automation_action=excluded.automation_action`,
        [
          findingId,
          runId,
          input.projectId,
          `rubric-fix-${index + 1}`,
          severity,
          `Archic rubric · priority ${index + 1}`,
          fix,
          JSON.stringify({
            source: "archic-rubric",
            rubricVersion: report.rubricVersion,
            projectScore: report.projectScore,
            status: report.status,
            highSlopFindings: report.highSlopFindings,
            slopSignals: report.slopFindings.map((finding) => finding.signalId),
          }),
        ],
      );
      await enqueueTask({
        projectId: input.projectId,
        findingId,
        type: "autofix",
        executor: "github_dispatch",
        priority: Math.max(70, 96 - index * 4),
        payload: {
          summary: fix,
          finding: {
            id: `rubric-fix-${index + 1}`,
            severity,
            detail: fix,
            recommendation: "Fix the highest-impact Archic rubric issue without broad redesign or fabricated content.",
          },
          qualityRunId: runId,
          rubricVersion: report.rubricVersion,
          archicScore: report.projectScore,
        },
        idempotencyKey: `rubric-autofix:${runId}:${index + 1}`,
        maxAttempts: 2,
      });
    }
  }

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
