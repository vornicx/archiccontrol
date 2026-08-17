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

function safeDownloadUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (!["github.com", "raw.githubusercontent.com", "codeload.github.com"].includes(url.hostname)) return null;
    return url.toString();
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

function safePath(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || candidate.startsWith("/") || candidate.split("/").some((part) => part === "..")) return null;
  return candidate;
}

function encodedPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function GET(request: Request) {
  const prospectId = new URL(request.url).searchParams.get("prospectId")?.trim();
  if (!prospectId) return NextResponse.json({ ok: false, error: "prospectId is required" }, { status: 400 });

  const prospect = await getProspectById(prospectId);
  if (!prospect) return NextResponse.json({ ok: false, error: "Prospect not found" }, { status: 404 });

  const prototype = record(prospect.research.prototype);
  const explicitDownload = safeDownloadUrl(prototype.downloadUrl);
  if (explicitDownload) return NextResponse.redirect(explicitDownload);

  const repository = safeRepository(prototype.repository) || safeRepository(prospect.repositoryFullName);
  const commit = safeCommit(prototype.commit);
  const path = safePath(prototype.path);

  if (repository && commit && path) {
    const rawUrl = `https://raw.githubusercontent.com/${repository}/${commit}/${encodedPath(path)}`;
    const upstream = await fetch(rawUrl, { cache: "no-store" });
    if (upstream.ok && upstream.body) {
      const filename = path.split("/").pop() || `${prospect.id}-prototype`;
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename.replace(/[\"\\]/g, "-")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
  }

  if (repository && commit) {
    return NextResponse.redirect(`https://codeload.github.com/${repository}/zip/${commit}`);
  }

  return NextResponse.json({ ok: false, error: "No verified downloadable prototype metadata is available" }, { status: 404 });
}
