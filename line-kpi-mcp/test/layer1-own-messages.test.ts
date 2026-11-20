import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SmllineCrmClient } from '../src/client.js';
import { runLayer1Pass } from '../src/worker/run-layer1.js';

const KEY = 'k-own';

// The group's recent messages belong only to another room (staff answer + customer "ขอบคุณครับ",
// which Layer 1 would close). The urgent room conv_target has none of its own messages in that
// window. It must be queued for Layer 2, never closed on the other room's messages.
describe('Layer 1 judges a room only on its own messages', () => {
  let server: http.Server;
  let baseUrl = '';
  const proposals: unknown[] = [];
  const enqueued: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      const url = new URL(req.url ?? '/', 'http://x');
      const send = (code: number, data?: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(data === undefined ? undefined : JSON.stringify(data));
      };
      if (req.headers['x-api-key'] !== KEY) return send(401, { error: 'Unauthorized' });

      if (url.pathname === '/api/v1/monitor') {
        return send(200, [
          {
            _id: 'grp_1', name: 'ร้าน B', lineGroupId: 'C2', isActive: true, priorityStatus: 'urgent',
            slowCount: 1, waitingCount: 0, openConvCount: 1, oldestPendingMs: 1_800_000, lastActivityAt: null,
            conversations: [
              { _id: 'conv_target', responseStatus: 'slow', pendingMs: 1_800_000,
                lastCustomerMessageAt: '2026-11-19T09:00:00.000Z', lastMessageAt: '2026-11-19T09:00:00.000Z',
                participantEmployeeIds: [] },
            ],
          },
        ]);
      }
      if (url.pathname === '/api/v1/messages') {
        return send(200, [
          { _id: 'o1', conversationId: 'conv_other', senderDisplayName: 'พนักงาน', senderType: 'employee',
            messageType: 'text', textContent: 'ส่งของให้แล้วครับ', timestamp: '2026-11-19T09:20:00.000Z' },
          { _id: 'o2', conversationId: 'conv_other', senderDisplayName: 'ลูกค้า', senderType: 'customer',
            messageType: 'text', textContent: 'ขอบคุณครับ', timestamp: '2026-11-19T09:25:00.000Z' },
        ]);
      }
      if (url.pathname === '/api/v1/auto-resolve/mode') return send(200, { mode: 'review' });
      if (req.method === 'POST' && url.pathname === '/api/v1/auto-resolve/propose') {
        proposals.push(body);
        return send(201, { ok: true, mode: 'review', status: 'pending_review' });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/auto-resolve/queue') {
        enqueued.push(body);
        return send(201, { ok: true, item: { _id: 'q1', status: 'pending' } });
      }
      return send(404, { error: 'Not found' });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  });

  it('queues the room for Layer 2 instead of closing it on another room\'s thanks', async () => {
    const client = new SmllineCrmClient({ baseUrl, apiKey: KEY });
    const summary = await runLayer1Pass(client, { minIdleMinutes: 2, logger: () => {} });

    expect(proposals).toHaveLength(0);
    expect(summary.items).toEqual([
      expect.objectContaining({ conversationId: 'conv_target', outcome: 'queued_layer2' }),
    ]);
    expect(enqueued).toEqual([expect.objectContaining({ conversationId: 'conv_target' })]);
  });
});
