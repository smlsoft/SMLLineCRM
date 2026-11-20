import http from 'node:http';

/**
 * Wraps an async job so concurrent callers share one run: a call made while a run is in
 * progress waits for that run and gets its result instead of starting another.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () => {
    if (!running) {
      running = fn().finally(() => {
        running = null;
      });
    }
    return running;
  };
}

export interface PassStatus<T> {
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSummary: T | null;
  lastError: string | null;
}

/**
 * Tracks a single-flight pass for background triggering: start() begins a pass (or joins the
 * running one) without waiting; status() reports the running flag and the last result.
 */
export function createPassTracker<T>(run: () => Promise<T>) {
  const state: PassStatus<T> = {
    running: false,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSummary: null,
    lastError: null,
  };
  let current: Promise<void> | null = null;

  const start = (): { started: boolean } => {
    if (current) return { started: false };
    state.running = true;
    state.lastStartedAt = new Date().toISOString();
    current = run()
      .then((summary) => {
        state.lastSummary = summary;
        state.lastError = null;
      })
      .catch((err) => {
        state.lastError = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        state.running = false;
        state.lastFinishedAt = new Date().toISOString();
        current = null;
      });
    return { started: true };
  };

  return {
    start,
    status: (): PassStatus<T> => ({ ...state }),
    /** Resolves when the running pass (if any) ends. For tests and shutdown. */
    idle: () => current ?? Promise.resolve(),
  };
}

export interface TriggerServerOptions<T> {
  port: number;
  apiKey: string;
  tracker: { start: () => { started: boolean }; status: () => PassStatus<T> };
  host?: string;
}

/**
 * Small internal HTTP server so the backend can ask for a Layer 1 pass now, in the background.
 * POST /run → 202 { ok, started, status } (started=false: joined the running pass).
 * GET /status → 200 status. Both need header X-API-Key. GET /health → 200.
 */
export function startTriggerServer<T>(opts: TriggerServerOptions<T>): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    req.resume(); // body is not used
    const path = (req.url ?? '/').split('?')[0];

    if (req.method === 'GET' && path === '/health') return send(200, { ok: true });
    const known = (req.method === 'POST' && path === '/run') || (req.method === 'GET' && path === '/status');
    if (!known) return send(404, { error: 'Not found' });
    if (req.headers['x-api-key'] !== opts.apiKey) return send(401, { error: 'Unauthorized' });

    if (path === '/status') return send(200, opts.tracker.status());
    const { started } = opts.tracker.start();
    send(202, { ok: true, started, status: opts.tracker.status() });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.host ?? '0.0.0.0', () => resolve(server));
  });
}
