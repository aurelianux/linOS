import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import express, { type Request, type Response } from "express";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT ?? 4002);

// ─── Types ──────────────────────────────────────────────────────────────────

interface GpuMetrics {
  name: string;
  utilizationPercent: number;
  memoryUsedMiB: number;
  memoryTotalMiB: number;
}

export interface BertaMetrics {
  hostname: string;
  uptimeSeconds: number;
  cpuLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  gpu: GpuMetrics | null;
}

// ─── TTL Cache ───────────────────────────────────────────────────────────────

let cachedMetrics: { value: BertaMetrics; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

// ─── GPU ─────────────────────────────────────────────────────────────────────

async function getGpuMetrics(): Promise<GpuMetrics | null> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,utilization.gpu,memory.used,memory.total",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 3000, env: { ...process.env, LC_ALL: "C" } }
    );

    const parts = stdout.trim().split(",").map((s) => s.trim());
    if (parts.length < 4) return null;

    const [name, util, memUsed, memTotal] = parts;
    const utilizationPercent = Number(util);
    const memoryUsedMiB = Number(memUsed);
    const memoryTotalMiB = Number(memTotal);

    if (
      !name ||
      Number.isNaN(utilizationPercent) ||
      Number.isNaN(memoryUsedMiB) ||
      Number.isNaN(memoryTotalMiB)
    ) {
      return null;
    }

    return {
      name,
      utilizationPercent: Math.min(100, Math.round(utilizationPercent)),
      memoryUsedMiB: Math.round(memoryUsedMiB),
      memoryTotalMiB: Math.round(memoryTotalMiB),
    };
  } catch {
    return null;
  }
}

// ─── Metrics collection ───────────────────────────────────────────────────────

async function collectMetrics(): Promise<BertaMetrics> {
  const now = Date.now();
  if (cachedMetrics && now < cachedMetrics.expiresAt) return cachedMetrics.value;

  const cpus = os.cpus();
  const load1 = os.loadavg()[0] ?? 0;
  const cpuLoadPercent =
    cpus.length > 0 ? Math.min(100, Math.round((load1 / cpus.length) * 100)) : 0;

  const gpu = await getGpuMetrics();

  const metrics: BertaMetrics = {
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpuLoadPercent,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    gpu,
  };

  cachedMetrics = { value: metrics, expiresAt: now + CACHE_TTL_MS };
  return metrics;
}

// ─── Server ──────────────────────────────────────────────────────────────────

const app = express();

app.get("/health", (_req: Request, res: Response): void => {
  res.json({ ok: true });
});

app.get("/metrics", async (_req: Request, res: Response): Promise<void> => {
  const data = await collectMetrics();
  res.json({ ok: true, data });
});

app.listen(PORT, () => {
  console.log(`berta-agent listening on port ${PORT}`);
});
