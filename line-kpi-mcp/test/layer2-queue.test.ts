import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SmllineCrmClient } from '../src/client.js';
import { createSmllineCrmMcpServer } from '../src/server.js';
import { runLayer1Pass } from '../src/worker/run-layer1.js';

const KEY = 'k-layer2';

// Fake SMLLineCRM backend: one urgent room with an open question (no Layer 1 rule
// can close it), one merely waiting room, and the triage queue endpoints.
describe('Layer 1 -> Layer 2 queue hand-off and read-only mode', () => {
  let server: http.Server;
  let baseUrl = '';
  let enqueued: Array<Record<string, unknown>> = [];
  let calls: string[] = [];

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      const url = new URL(req.url ?? '/', 'http://x');
      calls.push(`${req.method} ${url.pathname}`);
      const send = (code: number, data?: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(data === undefined ? undefined : JSON.stringify(data));
      };
      if (req.headers['x-api-key'] !== KEY) return send(401, { error: 'Unauthorized' });

      if (url.pathname === '/api/v1/monitor') {
        return send(200, [
          {
            _id: 'grp_u', name: 'ร้าน A', lineGroupId: 'C1', isActive: true, priorityStatus: 'urgent',
            slowCount: 1, waitingCount: 1, openConvCount: 2, oldestPendingMs: 1_500_000, lastActivityAt: null,
            conversations: [
              { _id: 'conv_q', responseStatus: 'slow', pendingMs: 1_500_000,
                lastCustomerMessageAt: '2026-11-19T10:00:00.000Z', lastMessageAt: '2026-11-19T10:00:00.000Z', participantEmployeeIds: [] },
              { _id: 'conv_w', responseStatus: 'waiting', pendingMs: 300_000,
                lastCustomerMessageAt: '2026-11-19T10:20:00.000Z', lastMessageAt: '2026-11-19T10:20:00.000Z', participantEmployeeIds: [] },
            ],
          },
        ]);
      }
      if (url.pathname === '/api/v1/messages') {
        return send(200, [
          { _id: 'm1', conversationId: 'conv_q', senderDisplayName: 'ลูกค้า', senderType: 'customer',
            messageType: 'text', textContent: 'สินค้าจะส่งถึงวันไหนครับ', timestamp: '2026-11-19T10:00:00.000Z' },
          { _id: 'm2', conversationId: 'conv_w', senderDisplayName: 'ลูกค้า', senderType: 'customer',
            messageType: 'text', textContent: 'ขอใบเสนอราคาหน่อยครับ', timestamp: '2026-11-19T10:20:00.000Z' },
        ]);
      }
      if (url.pathname === '/api/v1/auto-resolve/mode') return send(200, { mode: 'review' });
      if (req.method === 'POST' && url.pathname === '/api/v1/auto-resolve/queue') {
        enqueued.push(body);
        return enqueued.length === 1
          ? send(201, { ok: true, item: { _id: 'q1', status: 'pending' } })
          : send(200, { ok: true, skipped: 'duplicate', existingStatus: 'pending', itemId: 'q1' });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/auto-resolve/queue/claim') return send(204);
      if (url.pathname === '/api/v1/monitor/employees') return send(200, [{ _id: 'e1', name: 'พนักงาน A', status: 'active' }]);
      if (url.pathname === '/api/v1/conversations') {
        return send(200, [{ _id: 'c1', messageCount: 3, transcript: [{ text: 'long' }] }]);
      }
      return send(404, { error: 'Not found' });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  });

  beforeEach(() => {
    enqueued = [];
    calls = [];
  });

  it('checks only urgent rooms and enqueues the ones no rule decided; re-run is a duplicate', async () => {
    const client = new SmllineCrmClient({ baseUrl, apiKey: KEY });

    const first = await runLayer1Pass(client, { minIdleMinutes: 2, logger: () => {} });
    expect(first.checkedConversations).toBe(1); // conv_w (waiting) ignored
    expect(first.needsLayer2Count).toBe(1);
    expect(first.enqueuedCount).toBe(1);
    expect(enqueued).toEqual([
      expect.objectContaining({
        conversationId: 'conv_q',
        lastMessageAtSnapshot: '2026-11-19T10:00:00.000Z',
        enqueuedBy: 'smllinecrm-mcp/layer1',
      }),
    ]);

    const second = await runLayer1Pass(client, { minIdleMinutes: 2, logger: () => {} });
    expect(second.enqueuedCount).toBe(0);
    expect(second.items.find((i) => i.conversationId === 'conv_q')?.apiSkipped).toBe('duplicate');
  });

  it('dry-run never writes to the queue', async () => {
    const client = new SmllineCrmClient({ baseUrl, apiKey: KEY });
    const summary = await runLayer1Pass(client, { minIdleMinutes: 2, dryRun: true, logger: () => {} });
    expect(summary.needsLayer2Count).toBe(1);
    expect(enqueued).toHaveLength(0);
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
  });

  it('claimTriage returns null on 204', async () => {
    const client = new SmllineCrmClient({ baseUrl, apiKey: KEY });
    expect(await client.claimTriage('agent-1')).toBeNull();
  });

  it('read-only server hides write tools and strips transcripts', async () => {
    const mcp = createSmllineCrmMcpServer(new SmllineCrmClient({ baseUrl, apiKey: KEY }), { readOnly: true });
    const c = new Client({ name: 't', version: '0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([mcp.connect(st), c.connect(ct)]);
    try {
      const names = (await c.listTools()).tools.map((t) => t.name).sort();
      expect(names).toEqual([
        'evaluate_layer1_rule',
        'get_employee_activity_today',
        'get_group_messages',
        'list_conversations',
        'list_daily_jobs',
        'list_employees',
        'list_pending_groups',
      ]);
      const res = await c.callTool({ name: 'list_conversations', arguments: { date: '2026-11-19' } });
      const text = (res.content as Array<{ text: string }>)[0].text;
      expect(text).not.toContain('transcript');
      expect(JSON.parse(text).count).toBe(1);
      expect(calls).toContain('GET /api/v1/conversations');
    } finally {
      await c.close();
    }
  });
});
