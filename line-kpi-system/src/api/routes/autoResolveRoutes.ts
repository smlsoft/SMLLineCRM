import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  AutoResolveLayer,
  AutoResolveLog,
  AutoResolveStatus,
  IAutoResolveSnapshotMessage,
} from '../../models/AutoResolveLog';
import { Conversation } from '../../models/Conversation';
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

// POST /api/v1/auto-resolve/propose
autoResolveAgentRoutes.post('/propose', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      conversationId?: string;
      layer?: string;
      ruleCode?: string;
      reason?: string;
      confidence?: number;
      lastMessageAtSnapshot?: string;
      snapshotMessages?: unknown;
      proposedBy?: string;
    };

    if (!body.conversationId || !Types.ObjectId.isValid(body.conversationId)) {
      res.status(400).json({ error: 'Valid conversationId is required' });
      return;
    }

    if (!body.layer || !VALID_LAYERS.includes(body.layer as AutoResolveLayer)) {
      res.status(400).json({ error: 'layer must be "rule" or "ai"' });
      return;
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const snapshotDate = body.lastMessageAtSnapshot ? new Date(body.lastMessageAtSnapshot) : null;
    if (!snapshotDate || Number.isNaN(snapshotDate.getTime())) {
      res.status(400).json({ error: 'lastMessageAtSnapshot must be a valid ISO date' });
      return;
    }

    const conv = await Conversation.findById(body.conversationId).lean();
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

    // Prevent duplicate entries for the exact same customer message snapshot
    // (including rejected/reverted so the worker does not re-propose until a new customer message arrives).
    const existing = await AutoResolveLog.findOne({
      conversationId: conv._id,
      lastMessageAtSnapshot: snapshotDate,
      status: { $in: ['pending_review', 'approved', 'auto_resolved', 'rejected', 'reverted'] },
    }).lean();

    if (existing) {
      res.json({
        ok: true,
        skipped: 'duplicate',
        existingStatus: existing.status,
        logId: String(existing._id),
      });
      return;
    }

    const snapshotMessages = sanitizeSnapshotMessages(body.snapshotMessages, snapshotDate);
    const cfg = await configService.getConfig();
    const mode: AutoResolveMode = cfg.autoResolve?.mode ?? 'review';

    const ruleCode = typeof body.ruleCode === 'string' && body.ruleCode.trim() ? body.ruleCode.trim().slice(0, 64) : undefined;
    const confidence =
      typeof body.confidence === 'number' && Number.isFinite(body.confidence)
        ? Math.max(0, Math.min(1, body.confidence))
        : undefined;
    const proposedBy =
      typeof body.proposedBy === 'string' && body.proposedBy.trim()
        ? body.proposedBy.trim().slice(0, 64)
        : 'smllinecrm-mcp';

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
        res.json({ ok: true, skipped: 'stale_snapshot' });
        return;
      }

      const log = await AutoResolveLog.create({
        conversationId: conv._id,
        customerGroupId: conv.customerGroupId,
        lineGroupId: conv.lineGroupId,
        layer: body.layer as AutoResolveLayer,
        ruleCode,
        reason: reason.slice(0, 500),
        confidence,
        status: 'auto_resolved',
        lastMessageAtSnapshot: snapshotDate,
        snapshotMessages,
        proposedBy,
      });

      res.status(201).json({ ok: true, mode: 'auto', status: 'auto_resolved', log });
      return;
    }

    const log = await AutoResolveLog.create({
      conversationId: conv._id,
      customerGroupId: conv.customerGroupId,
      lineGroupId: conv.lineGroupId,
      layer: body.layer as AutoResolveLayer,
      ruleCode,
      reason: reason.slice(0, 500),
      confidence,
      status: 'pending_review',
      lastMessageAtSnapshot: snapshotDate,
      snapshotMessages,
      proposedBy,
    });

    res.status(201).json({ ok: true, mode: 'review', status: 'pending_review', log });
  } catch (err) {
    console.error('[autoResolveAgentRoutes] POST /propose error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin UI routes: mounted at /api/v1/admin/auto-resolve (API key + JWT) ───
export const autoResolveAdminRoutes = Router();

autoResolveAdminRoutes.use(requirePermission('auto-resolve'));

// GET /api/v1/admin/auto-resolve/logs?status=&layer=&page=&limit=
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
