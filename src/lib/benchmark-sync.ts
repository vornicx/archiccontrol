import "server-only";
import { benchmarkReportSchema } from "@/lib/benchmark-schema";
import { getBenchmarkHealth, type BenchmarkHealth } from "@/lib/benchmark-health";
import { ingestBenchmark } from "@/lib/repository";

export interface BenchmarkSyncResult {
  health: BenchmarkHealth;
  attempted: boolean;
  ingested: boolean;
  source: string;
  error: string | null;
}

export async function syncBenchmarkFromSource(): Promise<BenchmarkSyncResult> {
  const source = process.env.BENCHMARK_URL ?? "https://archicbenchmark.vercel.app/api/latest.json";
  const before = await getBenchmarkHealth();

  try {
    const response = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`Benchmark source unavailable (${response.status})`);

    const parsed = benchmarkReportSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Benchmark source returned an invalid report");

    const incomingAt = new Date(parsed.data.generatedAt).getTime();
    const currentAt = before.lastBenchmarkAt ? new Date(before.lastBenchmarkAt).getTime() : 0;
    if (!Number.isFinite(incomingAt)) throw new Error("Benchmark source timestamp is invalid");

    if (!before.lastBenchmarkAt || !Number.isFinite(currentAt) || incomingAt > currentAt) {
      await ingestBenchmark(parsed.data);
    }

    const health = await getBenchmarkHealth();
    return {
      health,
      attempted: true,
      ingested: !before.lastBenchmarkAt || !Number.isFinite(currentAt) || incomingAt > currentAt,
      source,
      error: null,
    };
  } catch (error) {
    return {
      health: await getBenchmarkHealth(),
      attempted: true,
      ingested: false,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureFreshBenchmark(): Promise<BenchmarkSyncResult> {
  const health = await getBenchmarkHealth();
  const source = process.env.BENCHMARK_URL ?? "https://archicbenchmark.vercel.app/api/latest.json";
  if (health.fresh) {
    return { health, attempted: false, ingested: false, source, error: null };
  }
  return syncBenchmarkFromSource();
}
