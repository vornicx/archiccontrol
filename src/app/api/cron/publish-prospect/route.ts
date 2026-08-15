import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/security";
import { publishVerifiedProspect } from "@/prospecting/publish-verified";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prospecting = await publishVerifiedProspect();
    return NextResponse.json({ ok: true, prospecting });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const POST = GET;
