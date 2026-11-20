import { afterEach, describe, expect, it } from 'vitest';
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPassTracker, singleFlight, startTriggerServer } from '../src/worker/trigger.js';

describe('background Layer 1 trigger', () => {
  let server: http.Server | null = null;
  afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  });

  it('singleFlight shares one running pass between concurrent callers', async () => {
    let calls = 0;
    let release!: () => void;
    const run = singleFlight(async () => {
      calls += 1;
      await new Promise<void>((r) => (release = r));
      return calls;
    });
    const a = run();
    const b = run();
    release();
    expect(await Promise.all([a, b])).toEqual([1, 1]);
    expect(calls).toBe(1);
  });

  it('POST /run answers 202 at once, runs one pass in the background for concurrent triggers, GET /status reports it', async () => {
    let calls = 0;
    let release!: () => void;
    const tracker = createPassTracker(async () => {
      calls += 1;
      await new Promise<void>((r) => (release = r));
      return { proposedCount: 2, enqueuedCount: 1 };
    });
    server = await startTriggerServer({ port: 0, host: '127.0.0.1', apiKey: 'k1', tracker });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const h = { 'X-API-Key': 'k1' };

    expect((await fetch(`${base}/run`, { method: 'POST' })).status).toBe(401);
    expect((await fetch(`${base}/status`)).status).toBe(401);

    const [r1, r2] = await Promise.all([
      fetch(`${base}/run`, { method: 'POST', headers: h }),
      fetch(`${base}/run`, { method: 'POST', headers: h }),
    ]);
    expect(r1.status).toBe(202);
    expect(r2.status).toBe(202);
    const started = [(await r1.json()).started, (await r2.json()).started].sort();
    expect(started).toEqual([false, true]); // the second joined the running pass
    expect((await (await fetch(`${base}/status`, { headers: h })).json()).running).toBe(true);

    release();
    await tracker.idle();
    const st = await (await fetch(`${base}/status`, { headers: h })).json();
    expect(st).toMatchObject({ running: false, lastSummary: { proposedCount: 2, enqueuedCount: 1 }, lastError: null });
    expect(calls).toBe(1);
  });

  it('a failed pass is reported in status.lastError', async () => {
    const tracker = createPassTracker(async () => {
      throw new Error('backend down');
    });
    tracker.start();
    await tracker.idle();
    expect(tracker.status()).toMatchObject({ running: false, lastError: 'backend down' });
  });
});
