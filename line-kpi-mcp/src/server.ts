import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SmllineCrmClient } from './client.js';
import { evaluateLayer1 } from './rules/layer1.js';

export interface SmllineCrmMcpServerOptions {
  /** Expose only read tools: no propose / triage queue writes. */
  readOnly?: boolean;
}

function jsonText(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateArg = z.string().regex(DATE_RE, 'YYYY-MM-DD (Asia/Bangkok)');

export function createSmllineCrmMcpServer(
  client: SmllineCrmClient,
  options: SmllineCrmMcpServerOptions = {}
): McpServer {
  const readOnly = options.readOnly ?? false;
  const server = new McpServer({
    name: 'smllinecrm-mcp',
    version: '0.1.0',
  });

  server.tool(
    'list_pending_groups',
    'List active LINE customer groups currently waiting or slow for staff reply (filtered by minimum customer idle minutes).',
    {
      minIdleMinutes: z.number().min(0).max(1440).default(2).describe('Minimum minutes since last customer message'),
    },
    async ({ minIdleMinutes }) => {
      const [groups, modeRes] = await Promise.all([
        client.getMonitorGroups(),
        client.getAutoResolveMode().catch(() => ({ mode: 'review' as const })),
      ]);

      const minIdleMs = minIdleMinutes * 60_000;
      const pendingGroups = groups
        .map((g) => ({
          ...g,
          conversations: g.conversations.filter(
            (c) =>
              (c.responseStatus === 'waiting' || c.responseStatus === 'slow') &&
              c.pendingMs >= minIdleMs
          ),
        }))
        .filter((g) => g.conversations.length > 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mode: modeRes.mode,
                totalPendingGroups: pendingGroups.length,
                groups: pendingGroups.map((g) => ({
                  groupId: g._id,
                  name: g.name,
                  lineGroupId: g.lineGroupId,
                  priorityStatus: g.priorityStatus,
                  conversations: g.conversations.map((c) => ({
                    conversationId: c._id,
                    responseStatus: c.responseStatus,
                    pendingMs: c.pendingMs,
                    lastCustomerMessageAt: c.lastCustomerMessageAt,
                    lastMessageAt: c.lastMessageAt,
                  })),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_group_messages',
    'Fetch recent messages in a customer group with image base64 data stripped to protect context budget.',
    {
      groupId: z.string().min(1).describe('CustomerGroup _id'),
      limit: z.number().int().min(1).max(50).default(15).describe('Number of recent messages to fetch'),
    },
    async ({ groupId, limit }) => {
      const messages = await client.getGroupMessages(groupId, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ groupId, count: messages.length, messages }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'evaluate_layer1_rule',
    'Run the deterministic Layer-1 Thai closing rule (sticker_only / closing_phrase) on a pending conversation without invoking an LLM.',
    {
      groupId: z.string().min(1).describe('CustomerGroup _id'),
      conversationId: z.string().min(1).describe('Conversation _id'),
      minIdleMinutes: z.number().min(0).max(1440).default(2).describe('Minimum idle minutes required before resolving'),
    },
    async ({ groupId, conversationId, minIdleMinutes }) => {
      const [groups, messages] = await Promise.all([
        client.getMonitorGroups(),
        client.getGroupMessages(groupId, 15),
      ]);

      const group = groups.find((g) => g._id === groupId);
      const conv = group?.conversations.find((c) => c._id === conversationId);
      if (!conv) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  found: false,
                  reason: 'Conversation not found among active monitor items',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const evaluation = evaluateLayer1({
        messages,
        pendingMs: conv.pendingMs,
        minIdleMinutes,
      });

      const snapshotMessages = messages.slice(-10).map((m) => ({
        senderType: m.senderType,
        senderDisplayName: m.senderDisplayName,
        messageType: m.messageType,
        ...(m.textContent ? { textContent: m.textContent } : {}),
        timestamp: m.timestamp,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                found: true,
                groupId,
                groupName: group?.name,
                conversationId,
                lastMessageAtSnapshot: conv.lastCustomerMessageAt ?? conv.lastMessageAt,
                evaluation,
                snapshotMessages,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Read-only reporting tools ─────────────────────────────────────────────

  server.tool(
    'get_employee_activity_today',
    'Today (Asia/Bangkok) per-employee activity: last response time, the group they last answered, idle minutes and active/idle/away status.',
    {},
    async () => jsonText(await client.getEmployeeActivityToday())
  );

  server.tool(
    'list_employees',
    'List employees (id, name, code, assigned groups) to resolve a name to an employeeId for other tools.',
    {},
    async () => jsonText(await client.getEmployees())
  );

  server.tool(
    'list_daily_jobs',
    'List categorized jobs (issues) for one day, filterable by employee, group and category. Categories come from the nightly AI analysis (23:00), so the current day is usually empty until then.',
    {
      date: dateArg.optional().describe('Day to list, YYYY-MM-DD; default today'),
      employeeId: z.string().optional(),
      groupId: z.string().optional().describe('CustomerGroup _id'),
      category: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async (args) => jsonText(await client.getDailyJobs(args))
  );

  server.tool(
    'list_conversations',
    'List conversations (max 200, newest first) with group, participants, message counts and response-time metrics. Use for live counts during the day.',
    {
      date: dateArg.optional().describe('Single day, YYYY-MM-DD'),
      startDate: dateArg.optional(),
      endDate: dateArg.optional(),
      groupId: z.string().optional().describe('CustomerGroup _id'),
      status: z.enum(['open', 'closed']).optional(),
    },
    async (args) => {
      const rows = await client.getConversations(args);
      const slim = rows.map((c) => {
        const { transcript: _t, ...rest } = c as Record<string, unknown> & { transcript?: unknown };
        return rest;
      });
      return jsonText({ count: slim.length, conversations: slim });
    }
  );

  if (readOnly) return server;

  // ── Write tools (hidden when readOnly) ────────────────────────────────────

  server.tool(
    'claim_triage_item',
    'Layer 2: claim the oldest urgent conversation Layer 1 could not decide. Returns the item, conversation (with conversation.minutesSinceLastCustomerMessage, whole minutes the customer has waited, computed by the backend) and its last 30 messages, or {empty:true}. Holds a lease; complete or release before it expires.',
    {
      agentId: z.string().min(1).max(64),
      leaseSeconds: z.number().int().min(30).max(1800).default(300),
    },
    async ({ agentId, leaseSeconds }) => {
      const claimed = await client.claimTriage(agentId, leaseSeconds);
      return jsonText(claimed ?? { empty: true });
    }
  );

  server.tool(
    'complete_triage_item',
    'Layer 2: report the verdict for a claimed item. "resolved" = no reply needed (goes through review/auto mode and the audit log); "needs_reply" = customer still waits (monitor shows ยังไม่ได้ตอบ). If the customer\'s latest message is an image, file, video, audio or location, the backend stores "resolved" as "needs_reply" and answers ok with overridden:true; that is a success, not an error.',
    {
      itemId: z.string().min(1),
      agentId: z.string().min(1).max(64),
      verdict: z.enum(['resolved', 'needs_reply']),
      reason: z.string().min(1).max(500),
      confidence: z.number().min(0).max(1).optional(),
    },
    async ({ itemId, ...payload }) => jsonText(await client.completeTriage(itemId, payload))
  );

  server.tool(
    'release_triage_item',
    'Layer 2: give a claimed item back after an error. After 3 attempts the item is marked failed.',
    {
      itemId: z.string().min(1),
      agentId: z.string().min(1).max(64),
      error: z.string().min(1).max(1000),
    },
    async ({ itemId, agentId, error }) => jsonText(await client.releaseTriage(itemId, agentId, error))
  );

  server.tool(
    'propose_auto_resolve',
    'Submit an auto-resolve decision to SMLLineCRM (creates pending_review entry in Review mode, or resolves immediately with audit log in Auto mode).',
    {
      conversationId: z.string().min(1),
      layer: z.enum(['rule', 'ai']),
      ruleCode: z.string().optional(),
      reason: z.string().min(1),
      confidence: z.number().min(0).max(1).optional(),
      lastMessageAtSnapshot: z.string().min(1),
      snapshotMessages: z
        .array(
          z.object({
            senderType: z.enum(['employee', 'customer']),
            senderDisplayName: z.string(),
            messageType: z.string(),
            textContent: z.string().optional(),
            timestamp: z.string(),
          })
        )
        .default([]),
    },
    async (args) => {
      const result = await client.proposeAutoResolve({
        conversationId: args.conversationId,
        layer: args.layer,
        ruleCode: args.ruleCode,
        reason: args.reason,
        confidence: args.confidence,
        lastMessageAtSnapshot: args.lastMessageAtSnapshot,
        snapshotMessages: args.snapshotMessages,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
