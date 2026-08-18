import { NextResponse } from "next/server";
import { getProspectById } from "@/prospecting/repository";

export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeZipDownloadUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (!["github.com", "codeload.github.com"].includes(url.hostname)) return null;
    const looksLikeZip = url.hostname === "codeload.github.com" || url.pathname.toLowerCase().endsWith(".zip") || url.pathname.includes("/archive/");
    return looksLikeZip ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeRepository(value: unknown): string | null {
  const candidate = text(value);
  return candidate && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate) ? candidate : null;
}

function safeCommit(value: unknown): string | null {
  const candidate = text(value);
  return candidate && /^[a-f0-9]{40}$/i.test(candidate) ? candidate : null;
}

export async function GET(request: Request) {
  const prospectId = new URL(request.url).searchParams.get("prospectId")?.trim();
  if (!prospectId) return NextResponse.json({ ok: false, error: "prospectId is required" }, { status: 400 });

  const prospect = await getProspectById(prospectId);
  if (!prospect) return NextResponse.json({ ok: false, error: "Prospect not found" }, { status: 404 });

  const prototype = record(prospect.research.prototype);
  const explicitZip = safeZipDownloadUrl(prototype.downloadUrl);
  if (explicitZip) return NextResponse.redirect(explicitZip);

  const repository = safeRepository(prototype.repository) || safeRepository(prospect.repositoryFullName);
  const commit = safeCommit(prototype.commit);

  if (repository && commit) {
    return NextResponse.redirect(`https://codeload.github.com/${repository}/zip/${commit}`);
  }

  return NextResponse.json({ ok: false, error: "No verified ZIP snapshot is available" }, { status: 404 });
}
