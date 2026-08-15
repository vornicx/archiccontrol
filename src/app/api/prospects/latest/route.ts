import { NextResponse } from "next/server";
import { getProspectingData } from "@/prospecting/repository";

export const runtime = "nodejs";

export async function GET() {
  const data = await getProspectingData();
  return NextResponse.json({ ok: true, persistenceConfigured: data.persistenceConfigured, prospect: data.today });
}
