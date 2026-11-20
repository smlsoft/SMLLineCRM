import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../../config';

/**
 * Layer 1 "check now" for the refresh button on /monitor and /auto-resolve. The worker runs the
 * pass in the background; these routes only start it and read its status, so no request waits
 * for a whole pass. Mounted behind jwtAuth.
 *   POST /api/v1/admin/layer1/check-now → 202 { ok, started, status }
 *   GET  /api/v1/admin/layer1/status    → 200 { running, lastStartedAt, lastFinishedAt, lastSummary, lastError }
 */
export const layer1Routes = Router();

const WORKER_TIMEOUT_MS = 10_000;

layer1Routes.use((req: Request, res: Response, next: NextFunction) => {
  const user = req.adminUser;
  const allowed =
    !!user && (user.isSuperAdmin || user.permissions.includes('monitor') || user.permissions.includes('auto-resolve'));
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    return;
  }
  if (!config.layer1WorkerUrl) {
    res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า LAYER1_WORKER_URL ให้ backend จึงสั่งตรวจทันทีไม่ได้' });
    return;
  }
  next();
});

async function callWorker(res: Response, method: 'POST' | 'GET', path: '/run' | '/status'): Promise<void> {
  try {
    const r = await fetch(new URL(path, config.layer1WorkerUrl), {
      method,
      headers: { 'X-API-Key': config.apiKey },
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      res.status(502).json({ error: `ตัวตรวจตอบกลับผิดพลาด: ${String(body.error ?? `HTTP ${r.status}`)}` });
      return;
    }
    res.status(r.status).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[layer1Routes] ${method} ${path} error:`, msg);
    res.status(503).json({ error: `ติดต่อตัวตรวจไม่ได้: ${msg}` });
  }
}

layer1Routes.post('/check-now', (_req: Request, res: Response) => callWorker(res, 'POST', '/run'));
layer1Routes.get('/status', (_req: Request, res: Response) => callWorker(res, 'GET', '/status'));
