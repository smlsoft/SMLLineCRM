import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SmllineCrmClient } from '../src/client.js';
import { createSmllineCrmMcpServer } from '../src/server.js';
import { runLayer1Pass } from '../src/worker/run-layer1.js';

const TEST_API_KEY = 'test-secret-key-123';
const FAKE_BASE64 = 'A'.repeat(4096);

interface RecordedRequest {
  method: string;
  url: string;
  apiKey: string | undefined;
  body?: unknown;
}

describe('smllinecrm-mcp server and Layer-1 runner', () => {
  let httpServer: http.Server;
  let baseUrl = '';
  let recordedRequests: RecordedRequest[] = [];
  let proposalsReceived: unknown[] = [];

  beforeAll(async () => {
    httpServer = http.createServer(async (req, res) => {
      const apiKey = req.headers['x-api-key'] as string | undefined;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;

      recordedRequests.push({
        method: req.method ?? 'GET',
        url: req.url ?? '',
        apiKey,
        body: parsedBody,
      });

      if (apiKey !== TEST_API_KEY) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (req.method === 'GET' && urlObj.pathname === '/api/v1/monitor') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify([
            {
              _id: 'grp_1',
              name: 'บริษัท ตัวอย่าง จำกัด',
              lineGroupId: 'C111',
              isActive: true,
              priorityStatus: 'urgent',
              slowCount: 1,
              waitingCount: 1,
              openConvCount: 2,
              oldestPendingMs: 240_000,
              lastActivityAt: '2026-11-19T10:04:00.000Z',
              conversations: [
                {
                  _id: 'conv_sticker',
                  responseStatus: 'waiting',
                  pendingMs: 240_000, // 4 minutes -> passes 2-minute idle filter
                  lastCustomerMessageAt: '2026-11-19T10:02:00.000Z',
                  lastMessageAt: '2026-11-19T10:02:00.000Z',
                  participantEmployeeIds: ['emp_1'],
                },
                {
                  _id: 'conv_too_fresh',
                  responseStatus: 'waiting',
                  pendingMs: 30_000, // 30 seconds -> filtered out
                  lastCustomerMessageAt: '2026-11-19T10:04:30.000Z',
                  lastMessageAt: '2026-11-19T10:04:30.000Z',
                  participantEmployeeIds: ['emp_1'],
                },
              ],
            },
          ])
        );
        return;
      }

      if (req.method === 'GET' && urlObj.pathname === '/api/v1/messages') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify([
            {
              _id: 'msg_1',
              conversationId: 'conv_sticker',
              senderDisplayName: 'ลูกค้าสมชาย',
              senderType: 'customer',
              messageType: 'image',
              mediaId: { _id: 'media_1', data: FAKE_BASE64, mimeType: 'image/png' },
              timestamp: '2026-11-19T10:00:00.000Z',
            },
            {
              _id: 'msg_2',
              conversationId: 'conv_sticker',
              senderDisplayName: 'พนักงาน A',
              senderType: 'employee',
              messageType: 'text',
              textContent: 'แก้ไขเรียบร้อยแล้วครับ',
              timestamp: '2026-11-19T10:01:00.000Z',
            },
            {
              _id: 'msg_3',
              conversationId: 'conv_sticker',
              senderDisplayName: 'ลูกค้าสมชาย',
              senderType: 'customer',
              messageType: 'sticker',
              timestamp: '2026-11-19T10:02:00.000Z',
            },
          ])
        );
        return;
      }

      if (req.method === 'GET' && urlObj.pathname === '/api/v1/auto-resolve/mode') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ mode: 'review' }));
        return;
      }

      if (req.method === 'POST' && urlObj.pathname === '/api/v1/auto-resolve/propose') {
        proposalsReceived.push(parsedBody);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            mode: 'review',
            status: 'pending_review',
            log: { _id: 'log_1', status: 'pending_review' },
          })
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    recordedRequests = [];
    proposalsReceived = [];
  });

  it('exposes all MCP tools over InMemoryTransport, sends X-API-Key, and strips base64', async () => {
    const apiClient = new SmllineCrmClient({ baseUrl, apiKey: TEST_API_KEY });
    const mcpServer = createSmllineCrmMcpServer(apiClient);
    const mcpClient = new Client({ name: 'test-client', version: '0.1.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      mcpServer.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);

    try {
      const toolsList = await mcpClient.listTools();
      expect(toolsList.tools.map((t) => t.name).sort()).toEqual([
        'claim_triage_item',
        'complete_triage_item',
        'evaluate_layer1_rule',
        'get_employee_activity_today',
        'get_group_messages',
        'list_conversations',
        'list_daily_jobs',
        'list_employees',
        'list_pending_groups',
        'propose_auto_resolve',
        'release_triage_item',
      ]);

      // 1. list_pending_groups filters out < 2 min pendingMs
      const listRes = await mcpClient.callTool({
        name: 'list_pending_groups',
        arguments: { minIdleMinutes: 2 },
      });
      const listJson = JSON.parse((listRes.content as Array<{ text: string }>)[0].text);
      expect(listJson.mode).toBe('review');
      expect(listJson.totalPendingGroups).toBe(1);
      expect(listJson.groups[0].conversations).toHaveLength(1);
      expect(listJson.groups[0].conversations[0].conversationId).toBe('conv_sticker');

      // 2. get_group_messages strips base64 completely
      const msgRes = await mcpClient.callTool({
        name: 'get_group_messages',
        arguments: { groupId: 'grp_1', limit: 15 },
      });
      const msgText = (msgRes.content as Array<{ text: string }>)[0].text;
      expect(msgText).not.toContain(FAKE_BASE64);
      const msgJson = JSON.parse(msgText);
      expect(msgJson.messages[0].hasImage).toBe(true);

      // 3. evaluate_layer1_rule matches sticker_only
      const evalRes = await mcpClient.callTool({
        name: 'evaluate_layer1_rule',
        arguments: { groupId: 'grp_1', conversationId: 'conv_sticker', minIdleMinutes: 2 },
      });
      const evalJson = JSON.parse((evalRes.content as Array<{ text: string }>)[0].text);
      expect(evalJson.found).toBe(true);
      expect(evalJson.evaluation.matched).toBe(true);
      expect(evalJson.evaluation.ruleCode).toBe('sticker_only');

      // 4. propose_auto_resolve posts payload to backend
      const proposeRes = await mcpClient.callTool({
        name: 'propose_auto_resolve',
        arguments: {
          conversationId: 'conv_sticker',
          layer: 'rule',
          ruleCode: evalJson.evaluation.ruleCode,
          reason: evalJson.evaluation.reason,
          confidence: 1,
          lastMessageAtSnapshot: evalJson.lastMessageAtSnapshot,
          snapshotMessages: evalJson.snapshotMessages,
        },
      });
      const proposeJson = JSON.parse((proposeRes.content as Array<{ text: string }>)[0].text);
      expect(proposeJson.ok).toBe(true);
      expect(proposeJson.status).toBe('pending_review');
      expect(proposalsReceived).toHaveLength(1);
      expect((proposalsReceived[0] as { conversationId: string }).conversationId).toBe('conv_sticker');

      // Every recorded HTTP call must carry X-API-Key
      expect(recordedRequests.length).toBeGreaterThan(0);
      for (const req of recordedRequests) {
        expect(req.apiKey).toBe(TEST_API_KEY);
      }
    } finally {
      await mcpClient.close();
    }
  });

  it('runs Layer-1 pass end-to-end with dryRun=true and dryRun=false', async () => {
    const apiClient = new SmllineCrmClient({ baseUrl, apiKey: TEST_API_KEY });

    const drySummary = await runLayer1Pass(apiClient, {
      minIdleMinutes: 2,
      dryRun: true,
      urgentOnly: false, // fixture conversations are "waiting"
      logger: () => {},
    });
    expect(drySummary.checkedGroups).toBe(1);
    expect(drySummary.checkedConversations).toBe(1);
    expect(drySummary.matchedCount).toBe(1);
    expect(drySummary.proposedCount).toBe(0);
    expect(proposalsReceived).toHaveLength(0);

    const realSummary = await runLayer1Pass(apiClient, {
      minIdleMinutes: 2,
      dryRun: false,
      urgentOnly: false,
      logger: () => {},
    });
    expect(realSummary.matchedCount).toBe(1);
    expect(realSummary.proposedCount).toBe(1);
    expect(proposalsReceived).toHaveLength(1);
  });
});
