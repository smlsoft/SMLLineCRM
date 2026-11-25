import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  AutoResolveLayer,
  AutoResolveLog,
  AutoResolveStatus,
  IAutoResolveSnapshotMessage,
} from '../../models/AutoResolveLog';
import { Conversation } from '../../models/Conversation';
import { Message, MessageType } from '../../models/Message';
import { TriageQueueItem, TRIAGE_MAX_ATTEMPTS } from '../../models/TriageQueueItem';
import { AutoResolveMode } from '../../models/SystemConfig';
import { configService } from '../../services/ConfigService';
import { requirePermission } from '../middleware/jwtAuth';

const VALID_STATUSES: AutoResolveStatus[] = [
  'pending_review',
  'approved',
  'rejected',
  'auto_resolved',
  'reverted',
  'expired',
];

const VALID_LAYERS: AutoResolveLayer[] = ['rule', 'ai'];

function sanitizeSnapshotMessages(raw: unknown, fallbackDate: Date): IAutoResolveSnapshotMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-15)
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const senderType: 'employee' | 'customer' =
        item.senderType === 'employee' ? 'employee' : 'customer';
      const parsedTs = item.timestamp ? new Date(String(item.timestamp)) : fallbackDate;
      const timestamp = Number.isNaN(parsedTs.getTime()) ? fallbackDate : parsedTs;
      const senderDisplayName =
        String(item.senderDisplayName ?? '').trim().slice(0, 120) ||
        (senderType === 'employee' ? 'พนักงาน' : 'ลูกค้า');
      const messageType = String(item.messageType ?? 'text').trim().slice(0, 32) || 'text';
      const textContent =
        typeof item.textContent === 'string' && item.textContent.length > 0
          ? item.textContent.slice(0, 1000)
          : undefined;

      return {
        senderType,
        senderDisplayName,
        messageType,
        textContent,
        timestamp,
      };
    });
}

// ── Agent routes: mounted at /api/v1/auto-resolve (X-API-Key only) ──────────
export const autoResolveAgentRoutes = Router();

// GET /api/v1/auto-resolve/mode
autoResolveAgentRoutes.get('/mode', async (_req: Request, res: Response) => {
  try {
    const cfg = await configService.getConfig();
    const mode: AutoResolveMode = cfg.autoResolve?.mode ?? 'review';
    res.json({ mode });
  } catch (err) {
    console.error('[autoResolveAgentRoutes] GET /mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Shared proposal logic (used by /propose and by /queue/:id/complete) ──────

interface ProposalInput {
  conversationId?: unknown;
  layer?: unknown;
  ruleCode?: unknown;
  reason?: unknown;
  confidence?: unknown;
  lastMessageAtSnapshot?: unknown;
  snapshotMessages?: unknown;
  proposedBy?: unknown;
}

interface ProposalResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/** Accepts an ISO string, a Date or epoch milliseconds (as the original /propose did). */
function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' && typeof raw !== 'number' && !(raw instanceof Date)) return null;
  if (raw === '' || raw === 0) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampConfidence(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : undefined;
}

function shortString(raw: unknown, max: number): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, max) : undefined;
}

/**
 * Validates a resolve proposal against the live conversation and writes the
 * AutoResolveLog (pending_review in review mode; auto_resolved + override in auto mode).
 */
async function submitProposal(input: ProposalInput): Promise<ProposalResult> {
  const conversationId = typeof input.conversationId === 'string' ? input.conversationId : '';
  if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
    return { httpStatus: 400, body: { error: 'Valid conversationId is required' } };
  }

  if (typeof input.layer !== 'string' || !VALID_LAYERS.includes(input.layer as AutoResolveLayer)) {
    return { httpStatus: 400, body: { error: 'layer must be "rule" or "ai"' } };
  }
  const layer = input.layer as AutoResolveLayer;

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) {
    return { httpStatus: 400, body: { error: 'reason is required' } };
  }

  const snapshotDate = parseIsoDate(input.lastMessageAtSnapshot);
  if (!snapshotDate) {
    return { httpStatus: 400, body: { error: 'lastMessageAtSnapshot must be a valid ISO date' } };
  }

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) {
    return { httpStatus: 404, body: { error: 'Conversation not found' } };
  }

  if (conv.status !== 'open' || conv.responseStatusOverride === 'normal') {
    return { httpStatus: 200, body: { ok: true, skipped: 'already_resolved' } };
  }

  if (
    !conv.lastCustomerMessageAt ||
    (conv.lastEmployeeMessageAt && conv.lastCustomerMessageAt <= conv.lastEmployeeMessageAt)
  ) {
    return { httpStatus: 200, body: { ok: true, skipped: 'employee_already_replied' } };
  }

  if (conv.lastCustomerMessageAt.getTime() > snapshotDate.getTime()) {
    return { httpStatus: 200, body: { ok: true, skipped: 'stale_snapshot' } };
  }

  // Prevent duplicate entries for the exact same customer message snapshot
  // (including rejected/reverted so the worker does not re-propose until a new customer message arrives).
  const existing = await AutoResolveLog.findOne({
    conversationId: conv._id,
    lastMessageAtSnapshot: snapshotDate,
    status: { $in: ['pending_review', 'approved', 'auto_resolved', 'rejected', 'reverted'] },
  }).lean();

  if (existing) {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        skipped: 'duplicate',
        existingStatus: existing.status,
        logId: String(existing._id),
      },
    };
  }

  const snapshotMessages = sanitizeSnapshotMessages(input.snapshotMessages, snapshotDate);
  const cfg = await configService.getConfig();
  const mode: AutoResolveMode = cfg.autoResolve?.mode ?? 'review';

  const ruleCode = shortString(input.ruleCode, 64);
  const confidence = clampConfidence(input.confidence);
  const proposedBy = shortString(input.proposedBy, 64) ?? 'smllinecrm-mcp';

  const baseLog = {
    conversationId: conv._id,
    customerGroupId: conv.customerGroupId,
    lineGroupId: conv.lineGroupId,
    layer,
    ruleCode,
    reason: reason.slice(0, 500),
    confidence,
    lastMessageAtSnapshot: snapshotDate,
    snapshotMessages,
    proposedBy,
  };

  if (mode === 'auto') {
    // Atomic staleness guard before marking conversation normal
    const updatedConv = await Conversation.findOneAndUpdate(
      {
        _id: conv._id,
        status: 'open',
        $or: [
          { lastCustomerMessageAt: { $lte: snapshotDate } },
          { lastCustomerMessageAt: null },
        ],
      },
      { $set: { responseStatusOverride: 'normal' } },
      { new: true }
    ).lean();

    if (!updatedConv) {
      return { httpStatus: 200, body: { ok: true, skipped: 'stale_snapshot' } };
    }

    const log = await AutoResolveLog.create({ ...baseLog, status: 'auto_resolved' });
    return { httpStatus: 201, body: { ok: true, mode: 'auto', status: 'auto_resolved', log } };
  }

  const log = await AutoResolveLog.create({ ...baseLog, status: 'pending_review' });
  return { httpStatus: 201, body: { ok: true, mode: 'review', status: 'pending_review', log } };
}

// POST /api/v1/auto-resolve/propose
autoResolveAgentRoutes.post('/propose', async (req: Request, res: Response) => {
  try {
    const result = await submitProposal((req.body ?? {}) as ProposalInput);
    res.status(result.httpStatus).json(result.body);
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /propose error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Layer 2 triage queue (Layer 1 worker enqueues, external AI agent claims) ──

const DEFAULT_LEASE_SECONDS = 300;
const MAX_LEASE_SECONDS = 1800;
const CLAIM_MESSAGE_LIMIT = 30;

function agentIdFrom(raw: unknown): string | null {
  return shortString(raw, 64) ?? null;
}

/** Messages for the agent: newest CLAIM_MESSAGE_LIMIT, oldest first, no media payload. */
async function loadConversationMessages(conversationId: Types.ObjectId) {
  const rows = await Message.find({ conversationId })
    .select('senderType senderDisplayName employeeId messageType textContent timestamp mediaId')
    .populate('employeeId', 'name employeeCode')
    .populate('mediaId', 'url mimeType')
    .sort({ timestamp: -1 })
    .limit(CLAIM_MESSAGE_LIMIT)
    .lean();
  return rows.reverse();
}

/**
 * Customer message types the AI cannot judge from text: when one is the customer's latest
 * message, a "resolved" verdict is overridden to "needs_reply". Stickers are not included.
 */
const MEDIA_LAST_TYPES: MessageType[] = ['image', 'file', 'video', 'audio', 'location'];
const MEDIA_LAST_OVERRIDE_PREFIX = 'ระบบเปลี่ยนเป็นต้องตอบ: ลูกค้าส่งรูป/ไฟล์เป็นข้อความล่าสุด';

/** Whole minutes from `lastCustomerAt` to `at`, never negative. */
function minutesBetween(lastCustomerAt: Date, at: Date): number {
  return Math.max(0, Math.floor((at.getTime() - lastCustomerAt.getTime()) / 60000));
}

// POST /api/v1/auto-resolve/queue
// Body: { conversationId, lastMessageAtSnapshot, reason?, enqueuedBy? }
autoResolveAgentRoutes.post('/queue', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ error: 'Valid conversationId is required' });
      return;
    }
    const snapshotDate = parseIsoDate(body.lastMessageAtSnapshot);
    if (!snapshotDate) {
      res.status(400).json({ error: 'lastMessageAtSnapshot must be a valid ISO date' });
      return;
    }

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conv.status !== 'open' || conv.responseStatusOverride === 'normal') {
      res.json({ ok: true, skipped: 'already_resolved' });
      return;
    }
    if (
      !conv.lastCustomerMessageAt ||
      (conv.lastEmployeeMessageAt && conv.lastCustomerMessageAt <= conv.lastEmployeeMessageAt)
    ) {
      res.json({ ok: true, skipped: 'employee_already_replied' });
      return;
    }
    if (conv.lastCustomerMessageAt.getTime() > snapshotDate.getTime()) {
      res.json({ ok: true, skipped: 'stale_snapshot' });
      return;
    }

    try {
      const item = await TriageQueueItem.create({
        conversationId: conv._id,
        customerGroupId: conv.customerGroupId,
        lineGroupId: conv.lineGroupId,
        lastMessageAtSnapshot: snapshotDate,
        enqueueReason: shortString(body.reason, 500),
        enqueuedBy: shortString(body.enqueuedBy, 64) ?? 'smllinecrm-mcp',
      });
      res.status(201).json({ ok: true, item });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const existing = await TriageQueueItem.findOne({
          conversationId: conv._id,
          lastMessageAtSnapshot: snapshotDate,
        }).lean();
        res.json({
          ok: true,
          skipped: 'duplicate',
          existingStatus: existing?.status,
          itemId: existing ? String(existing._id) : undefined,
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /queue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/auto-resolve/queue/count → 200 { pending }
// Number of items POST /queue/claim could take right now (same filter), without leasing one.
// An agent host polls this to wake the Layer 2 agent only when there is work. Read-only: stale
// rooms are expired by claim, so a count may include an item claim then drops.
autoResolveAgentRoutes.get('/queue/count', async (_req: Request, res: Response) => {
  try {
    const pending = await TriageQueueItem.countDocuments({
      attempts: { $lt: TRIAGE_MAX_ATTEMPTS },
      $or: [{ status: 'pending' }, { status: 'claimed', leaseUntil: { $lt: new Date() } }],
    });
    res.json({ pending });
  } catch (err) {
    console.error('[autoResolveAgentRoutes] GET /queue/count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auto-resolve/queue/claim
// Body: { agentId, leaseSeconds? } → 200 { item, conversation, messages } | 204
autoResolveAgentRoutes.post('/queue/claim', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentId = agentIdFrom(body.agentId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    const leaseSeconds =
      typeof body.leaseSeconds === 'number' && Number.isFinite(body.leaseSeconds)
        ? Math.min(Math.max(Math.round(body.leaseSeconds), 30), MAX_LEASE_SECONDS)
        : DEFAULT_LEASE_SECONDS;

    // Items whose lease ran out after their last allowed attempt are given up on.
    await TriageQueueItem.updateMany(
      { status: 'claimed', leaseUntil: { $lt: new Date() }, attempts: { $gte: TRIAGE_MAX_ATTEMPTS } },
      { $set: { status: 'failed', lastError: 'lease expired on last attempt' }, $unset: { leaseUntil: 1 } }
    );

    // Loop so an item whose conversation went stale is expired and the next one is tried.
    for (let i = 0; i < 20; i++) {
      const now = new Date();
      const item = await TriageQueueItem.findOneAndUpdate(
        {
          attempts: { $lt: TRIAGE_MAX_ATTEMPTS },
          $or: [
            { status: 'pending' },
            { status: 'claimed', leaseUntil: { $lt: now } },
          ],
        },
        {
          $inc: { attempts: 1 },
          $set: {
            status: 'claimed',
            claimedBy: agentId,
            claimedAt: now,
            leaseUntil: new Date(now.getTime() + leaseSeconds * 1000),
          },
        },
        { sort: { createdAt: 1 }, new: true }
      );

      if (!item) {
        res.status(204).end();
        return;
      }

      const conv = await Conversation.findById(item.conversationId).lean();
      const staleReason = !conv
        ? 'บทสนทนาไม่พบแล้ว'
        : conv.status !== 'open' || conv.responseStatusOverride === 'normal'
          ? 'บทสนทนาถูกปิดหรือแก้สถานะแล้ว'
          : !conv.lastCustomerMessageAt ||
              (conv.lastEmployeeMessageAt && conv.lastCustomerMessageAt <= conv.lastEmployeeMessageAt)
            ? 'พนักงานตอบแล้ว'
            : conv.lastCustomerMessageAt.getTime() > item.lastMessageAtSnapshot.getTime()
              ? 'ลูกค้าส่งข้อความใหม่เข้ามาหลังเข้าคิว'
              : null;

      if (staleReason || !conv) {
        await TriageQueueItem.updateOne(
          { _id: item._id, status: 'claimed', claimedBy: agentId },
          { $set: { status: 'expired', expiredReason: staleReason ?? 'บทสนทนาไม่พบแล้ว' }, $unset: { leaseUntil: 1 } }
        );
        continue;
      }

      const messages = await loadConversationMessages(conv._id);
      // Precomputed so the agent does not do date arithmetic itself. The stale check above
      // guarantees the customer wrote last, so this is how long the customer has waited.
      const minutesSinceLastCustomerMessage = conv.lastCustomerMessageAt
        ? minutesBetween(conv.lastCustomerMessageAt, item.claimedAt ?? now)
        : null;
      res.json({
        item,
        conversation: {
          _id: conv._id,
          customerGroupId: conv.customerGroupId,
          lineGroupId: conv.lineGroupId,
          status: conv.status,
          lastCustomerMessageAt: conv.lastCustomerMessageAt,
          lastEmployeeMessageAt: conv.lastEmployeeMessageAt,
          lastMessageAt: conv.lastMessageAt,
          minutesSinceLastCustomerMessage,
        },
        messages,
      });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /queue/claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function findHeldItem(id: string, agentId: string) {
  return TriageQueueItem.findOne({
    _id: id,
    status: 'claimed',
    claimedBy: agentId,
    leaseUntil: { $gte: new Date() },
  });
}

// POST /api/v1/auto-resolve/queue/:id/complete
// Body: { agentId, verdict: "resolved" | "needs_reply", reason, confidence?, snapshotMessages? }
autoResolveAgentRoutes.post('/queue/:id/complete', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid queue item id' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentId = agentIdFrom(body.agentId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    const verdict = body.verdict;
    if (verdict !== 'resolved' && verdict !== 'needs_reply') {
      res.status(400).json({ error: 'verdict must be "resolved" or "needs_reply"' });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const item = await findHeldItem(id, agentId);
    if (!item) {
      res.status(409).json({ error: 'Lease lost, item expired, or item not claimed by this agent' });
      return;
    }

    const confidence = clampConfidence(body.confidence);

    // Media-last guard: the AI cannot see what a picture/file asks for, so a "resolved"
    // verdict on a room whose latest customer message is media is stored as "needs_reply".
    // This guard only ever turns resolved into needs_reply, never the reverse.
    let storedVerdict: 'resolved' | 'needs_reply' = verdict;
    let storedReason = reason;
    let overridden = false;
    if (verdict === 'resolved') {
      const lastCustomerMessage = await Message.findOne({
        conversationId: item.conversationId,
        senderType: 'customer',
      })
        .sort({ timestamp: -1, _id: -1 })
        .select('messageType')
        .lean();
      if (lastCustomerMessage && MEDIA_LAST_TYPES.includes(lastCustomerMessage.messageType)) {
        storedVerdict = 'needs_reply';
        storedReason = `${MEDIA_LAST_OVERRIDE_PREFIX} | เหตุผลเดิมของ AI: ${reason}`;
        overridden = true;
      }
    }

    if (storedVerdict === 'needs_reply') {
      const updated = await TriageQueueItem.findOneAndUpdate(
        { _id: item._id, status: 'claimed', claimedBy: agentId },
        {
          $set: {
            status: 'done',
            verdict: storedVerdict,
            verdictReason: storedReason.slice(0, 500),
            confidence,
            completedAt: new Date(),
          },
          $unset: { leaseUntil: 1 },
        },
        { new: true }
      );
      if (!updated) {
        res.status(409).json({ error: 'Item changed while completing' });
        return;
      }
      res.json({
        ok: true,
        verdict: storedVerdict,
        ...(overridden ? { overridden: true, requestedVerdict: verdict, overrideReason: 'media_last' } : {}),
        item: updated,
      });
      return;
    }

    const proposal = await submitProposal({
      conversationId: String(item.conversationId),
      layer: 'ai',
      ruleCode: 'layer2_ai',
      reason,
      confidence,
      lastMessageAtSnapshot: item.lastMessageAtSnapshot.toISOString(),
      snapshotMessages: body.snapshotMessages,
      proposedBy: agentId,
    });

    if (proposal.httpStatus >= 400) {
      // Do not leave the item claimed until its lease runs out: a missing conversation
      // can never be decided (expire it); any other 4xx is a bad agent request
      // (give it back like /release, failing it after the last attempt).
      const error = String(proposal.body.error ?? `proposal rejected with ${proposal.httpStatus}`).slice(0, 1000);
      const set: Record<string, unknown> =
        proposal.httpStatus === 404
          ? { status: 'expired', expiredReason: `proposal rejected: ${error}` }
          : { status: item.attempts >= TRIAGE_MAX_ATTEMPTS ? 'failed' : 'pending', lastError: error };
      const unset: Record<string, 1> =
        proposal.httpStatus === 404 ? { leaseUntil: 1 } : { leaseUntil: 1, claimedBy: 1, claimedAt: 1 };
      const updated = await TriageQueueItem.findOneAndUpdate(
        { _id: item._id, status: 'claimed', claimedBy: agentId },
        { $set: set, $unset: unset },
        { new: true }
      );
      res.status(proposal.httpStatus).json({ ...proposal.body, item: updated });
      return;
    }

    const skipped = typeof proposal.body.skipped === 'string' ? proposal.body.skipped : undefined;
    const createdLog = proposal.body.log as { _id?: Types.ObjectId } | undefined;
    const logId = createdLog?._id ?? (typeof proposal.body.logId === 'string' ? proposal.body.logId : undefined);

    const set: Record<string, unknown> =
      skipped && skipped !== 'duplicate'
        ? { status: 'expired', expiredReason: `proposal skipped: ${skipped}` }
        : {
            status: 'done',
            verdict,
            verdictReason: reason.slice(0, 500),
            confidence,
            completedAt: new Date(),
            ...(logId ? { autoResolveLogId: logId } : {}),
          };

    const updated = await TriageQueueItem.findOneAndUpdate(
      { _id: item._id, status: 'claimed', claimedBy: agentId },
      { $set: set, $unset: { leaseUntil: 1 } },
      { new: true }
    );

    res.status(proposal.httpStatus).json({ ...proposal.body, verdict, item: updated });
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /queue/:id/complete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auto-resolve/queue/:id/release
// Body: { agentId, error } — gives the item back; after TRIAGE_MAX_ATTEMPTS it is marked failed.
autoResolveAgentRoutes.post('/queue/:id/release', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid queue item id' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentId = agentIdFrom(body.agentId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    const item = await findHeldItem(id, agentId);
    if (!item) {
      res.status(409).json({ error: 'Lease lost, item expired, or item not claimed by this agent' });
      return;
    }

    // attempts was already counted when the item was claimed.
    const attempts = item.attempts;
    const updated = await TriageQueueItem.findOneAndUpdate(
      { _id: item._id, status: 'claimed', claimedBy: agentId },
      {
        $set: {
          status: attempts >= TRIAGE_MAX_ATTEMPTS ? 'failed' : 'pending',
          lastError: shortString(body.error, 1000) ?? 'released without error message',
        },
        $unset: { leaseUntil: 1, claimedBy: 1, claimedAt: 1 },
      },
      { new: true }
    );

    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /queue/:id/release error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin UI routes: mounted at /api/v1/admin/auto-resolve (API key + JWT) ───
export const autoResolveAdminRoutes = Router();

autoResolveAdminRoutes.use(requirePermission('auto-resolve'));

// GET /api/v1/admin/auto-resolve/logs?status=&layer=&page=&limit=
// GET /api/v1/admin/auto-resolve/queue → { counts: { queued, needs_reply }, data }
// Rooms the Layer 2 (AI) queue holds for the room's current customer message — the same rooms
// /monitor badges "รอ AI ตรวจ" / "ยังไม่ได้ตอบ" (filter and snapshot match as attachTriageStatus).
autoResolveAdminRoutes.get('/queue', async (_req: Request, res: Response) => {
  try {
    const items = await TriageQueueItem.find({
      $or: [
        { status: 'pending' },
        { status: 'claimed', $or: [{ leaseUntil: { $gte: new Date() } }, { attempts: { $lt: TRIAGE_MAX_ATTEMPTS } }] },
        { status: 'done', verdict: 'needs_reply' },
      ],
    })
      .populate('customerGroupId', 'name')
      .sort({ createdAt: 1 })
      .lean();

    const convIds = [...new Set(items.map((it) => String(it.conversationId)))];
    const convs = await Conversation.find({ _id: { $in: convIds } })
      .select('status responseStatusOverride lastCustomerMessageAt lastEmployeeMessageAt')
      .lean();
    const convById = new Map(convs.map((c) => [String(c._id), c]));

    // One entry per conversation; needs_reply outranks queued.
    const byConv = new Map<string, { item: (typeof items)[number]; triageStatus: 'queued' | 'needs_reply' }>();
    for (const it of items) {
      const c = convById.get(String(it.conversationId));
      const waiting =
        c &&
        c.status === 'open' &&
        c.responseStatusOverride !== 'normal' &&
        c.lastCustomerMessageAt &&
        (!c.lastEmployeeMessageAt || c.lastCustomerMessageAt > c.lastEmployeeMessageAt) &&
        c.lastCustomerMessageAt.getTime() === new Date(it.lastMessageAtSnapshot).getTime();
      if (!waiting) continue;
      const triageStatus = it.status === 'done' ? 'needs_reply' : 'queued';
      const cur = byConv.get(String(it.conversationId));
      if (!cur || (cur.triageStatus === 'queued' && triageStatus === 'needs_reply')) {
        byConv.set(String(it.conversationId), { item: it, triageStatus });
      }
    }

    const entries = [...byConv.values()];
    const data = await Promise.all(
      entries.map(async ({ item, triageStatus }) => {
        const messages = await loadConversationMessages(item.conversationId);
        return {
          _id: item._id,
          conversationId: item.conversationId,
          customerGroupId: item.customerGroupId,
          lineGroupId: item.lineGroupId,
          triageStatus,
          status: item.status,
          enqueueReason: item.enqueueReason,
          enqueuedBy: item.enqueuedBy,
          claimedBy: item.claimedBy,
          attempts: item.attempts,
          verdictReason: item.verdictReason,
          confidence: item.confidence,
          lastMessageAtSnapshot: item.lastMessageAtSnapshot,
          createdAt: item.createdAt,
          completedAt: item.completedAt,
          snapshotMessages: messages.map((m) => ({
            senderType: m.senderType,
            senderDisplayName: m.senderDisplayName,
            messageType: m.messageType,
            ...(m.textContent ? { textContent: m.textContent } : {}),
            timestamp: m.timestamp,
          })),
        };
      })
    );

    res.json({
      counts: {
        queued: entries.filter((e) => e.triageStatus === 'queued').length,
        needs_reply: entries.filter((e) => e.triageStatus === 'needs_reply').length,
      },
      data,
    });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] GET /queue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

autoResolveAdminRoutes.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      status = 'all',
      layer,
      page: pageStr,
      limit: limitStr,
    } = req.query as {
      status?: string;
      layer?: string;
      page?: string;
      limit?: string;
    };

    const page = Math.max(Number(pageStr) || 1, 1);
    const limit = Math.min(Math.max(Number(limitStr) || 30, 1), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      if (!VALID_STATUSES.includes(status as AutoResolveStatus)) {
        res.status(400).json({ error: 'Invalid status filter' });
        return;
      }
      filter.status = status;
    }
    if (layer) {
      if (!VALID_LAYERS.includes(layer as AutoResolveLayer)) {
        res.status(400).json({ error: 'Invalid layer filter' });
        return;
      }
      filter.layer = layer;
    }

    const [cfg, total, data, aggCounts] = await Promise.all([
      configService.getConfig(),
      AutoResolveLog.countDocuments(filter),
      AutoResolveLog.find(filter)
        .populate('customerGroupId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AutoResolveLog.aggregate<{ _id: AutoResolveStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const counts: Record<AutoResolveStatus, number> = {
      pending_review: 0,
      approved: 0,
      rejected: 0,
      auto_resolved: 0,
      reverted: 0,
      expired: 0,
    };
    for (const row of aggCounts) {
      if (row._id in counts) {
        counts[row._id] = row.count;
      }
    }

    const mode: AutoResolveMode = cfg.autoResolve?.mode ?? 'review';
    res.json({
      mode,
      counts,
      data,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] GET /logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/auto-resolve/logs/:id/approve
autoResolveAdminRoutes.post('/logs/:id/approve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid log id' });
      return;
    }

    const log = await AutoResolveLog.findById(id);
    if (!log) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    if (log.status !== 'pending_review') {
      res.status(409).json({ error: `รายการนี้ไม่อยู่ในสถานะรอตรวจ (สถานะปัจจุบัน: ${log.status})` });
      return;
    }

    const conv = await Conversation.findById(log.conversationId).lean();
    if (!conv || conv.status !== 'open') {
      log.status = 'expired';
      log.expiredReason = 'บทสนทนาถูกปิดไปแล้ว';
      await log.save();
      res.status(409).json({ error: 'บทสนทนานี้ปิดไปแล้ว รายการถูกปรับเป็นหมดอายุ' });
      return;
    }

    if (
      conv.lastCustomerMessageAt &&
      conv.lastCustomerMessageAt.getTime() > log.lastMessageAtSnapshot.getTime()
    ) {
      log.status = 'expired';
      log.expiredReason = 'ลูกค้าส่งข้อความใหม่เข้ามาหลังระบบประเมิน';
      await log.save();
      res.status(409).json({ error: 'มีข้อความใหม่จากลูกค้าเข้ามาแล้ว รายการนี้ถูกปรับเป็นหมดอายุ' });
      return;
    }

    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { responseStatusOverride: 'normal' } }
    );

    log.status = 'approved';
    log.reviewedBy = req.adminUser?.username ?? 'admin';
    log.reviewedAt = new Date();
    await log.save();

    const populated = await AutoResolveLog.findById(log._id)
      .populate('customerGroupId', 'name')
      .lean();

    res.json({ ok: true, log: populated });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] POST /logs/:id/approve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/auto-resolve/logs/:id/reject
autoResolveAdminRoutes.post('/logs/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid log id' });
      return;
    }

    const log = await AutoResolveLog.findById(id);
    if (!log) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    if (log.status !== 'pending_review') {
      res.status(409).json({ error: `รายการนี้ไม่อยู่ในสถานะรอตรวจ (สถานะปัจจุบัน: ${log.status})` });
      return;
    }

    const { note } = req.body as { note?: string };
    log.status = 'rejected';
    log.reviewedBy = req.adminUser?.username ?? 'admin';
    log.reviewedAt = new Date();
    log.reviewNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : undefined;
    await log.save();

    const populated = await AutoResolveLog.findById(log._id)
      .populate('customerGroupId', 'name')
      .lean();

    res.json({ ok: true, log: populated });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] POST /logs/:id/reject error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/auto-resolve/logs/:id/revert
autoResolveAdminRoutes.post('/logs/:id/revert', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid log id' });
      return;
    }

    const log = await AutoResolveLog.findById(id);
    if (!log) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    if (log.status !== 'approved' && log.status !== 'auto_resolved') {
      res.status(409).json({ error: 'ยกเลิกได้เฉพาะรายการที่อนุมัติหรือปิดอัตโนมัติไปแล้วเท่านั้น' });
      return;
    }

    await Conversation.updateOne(
      { _id: log.conversationId },
      { $set: { responseStatusOverride: null } }
    );

    log.status = 'reverted';
    log.revertedBy = req.adminUser?.username ?? 'admin';
    log.revertedAt = new Date();
    await log.save();

    const populated = await AutoResolveLog.findById(log._id)
      .populate('customerGroupId', 'name')
      .lean();

    res.json({ ok: true, log: populated });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] POST /logs/:id/revert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/auto-resolve/mode
autoResolveAdminRoutes.patch('/mode', async (req: Request, res: Response) => {
  try {
    const { mode } = req.body as { mode?: AutoResolveMode };
    if (mode !== 'review' && mode !== 'auto') {
      res.status(400).json({ error: 'mode must be "review" or "auto"' });
      return;
    }

    await configService.updateConfig({ 'autoResolve.mode': mode });
    res.json({ ok: true, mode });
  } catch (err) {
    console.error('[autoResolveAdminRoutes] PATCH /mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
