import { Router, Request, Response } from 'express';
import { Message } from '../../models/Message';

const router = Router({ mergeParams: true });

const MAX_LIMIT = 500;

// GET /api/v1/conversations/:conversationId/messages[?limit=N][&noMedia=1]
// Oldest first. Without options: every message, image payloads included (unchanged).
// limit: only the newest N (1-500), still oldest first. noMedia=1: media url/mimeType without the
// base64 `data`, for light previews.
router.get('/', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : 0;
  const noMedia = req.query.noMedia === '1' || req.query.noMedia === 'true';
  const mediaFields = noMedia ? 'url mimeType' : 'data url mimeType';

  const query = Message.find({ conversationId })
    .populate('employeeId', 'name employeeCode')
    .populate('mediaId', mediaFields);

  if (limit) {
    const newest = await query.sort({ timestamp: -1 }).limit(limit).lean();
    res.json(newest.reverse());
    return;
  }

  const messages = await query.sort({ timestamp: 1 }).lean();
  res.json(messages);
});

export { router as messageRoutes };
