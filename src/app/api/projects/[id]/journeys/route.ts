import { NextResponse } from "next/server";
import { journeyManifests } from "@/automation/manifests";
import { db, hasDatabase } from "@/lib/db";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyBearer(request, process.env.AGENT_SECRET) && !verifyBearer(request, process.env.INTEGRATION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (hasDatabase()) {
    const rows = await db().query(`select manifest,version,source,content_sha,validated_at from journey_manifests where project_id=$1`, [id]);
    if (rows[0]) return NextResponse.json(rows[0]);
  }
  const manifest = journeyManifests.get(id);
  return manifest ? NextResponse.json({ manifest, version: 1, source: "control" }) : NextResponse.json({ error: "Journey manifest not found" }, { status: 404 });
}

