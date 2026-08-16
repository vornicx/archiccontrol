import "server-only";

function normalize(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed)) throw new Error("Archic Control public URL must use HTTPS");
  return trimmed;
}

export function getControlPublicUrl(): string {
  if (process.env.CONTROL_PUBLIC_URL) return normalize(process.env.CONTROL_PUBLIC_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalize(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  throw new Error("Archic Control public URL is not configured");
}
