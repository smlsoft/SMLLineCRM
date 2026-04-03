import { Router, Request, Response } from 'express';
import { Message } from '../../models/Message';

const router = Router({ mergeParams: true });

// GET /api/v1/conversations/:conversationId/messages
router.get('/', async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  const messages = await Message.find({ conversationId })
    .populate('employeeId', 'name employeeCode')
    .populate('mediaId', 'data url mimeType')
    .sort({ timestamp: 1 })
    .lean();

  res.json(messages);
});

export { router as messageRoutes };
