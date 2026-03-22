import { Router, Request, Response } from 'express';
import { Message } from '../../models/Message';

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/v1/messages?groupId=&before=<ISO timestamp>&limit=50
 *
 * Cursor-based pagination — returns messages older than `before`,
 * sorted newest-first (DESC), then reversed to chronological order.
 * Caller can detect "no more pages" when returned count < limit.
 */
router.get('/', async (req: Request, res: Response) => {
  const { groupId, before, limit: limitStr } = req.query as {
    groupId?: string;
    before?: string;
    limit?: string;
  };

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' });
    return;
  }

  const limit = Math.min(Number(limitStr) || DEFAULT_LIMIT, MAX_LIMIT);

  const filter: Record<string, unknown> = { customerGroupId: groupId };
  if (before) {
    filter.timestamp = { $lt: new Date(before) };
  }

  const messages = await Message.find(filter)
    .populate('employeeId', 'name employeeCode')
    .sort({ timestamp: -1 }) // newest first for efficient pagination
    .limit(limit)
    .lean();

  // Return in chronological order (oldest first) so frontend can prepend correctly
  res.json(messages.reverse());
});

export { router as groupMessageRoutes };
