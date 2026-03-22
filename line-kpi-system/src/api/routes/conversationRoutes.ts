import { Router, Request, Response } from 'express';
import { Conversation } from '../../models/Conversation';

const router = Router();

// GET /api/v1/conversations?groupId=&date=YYYY-MM-DD&startDate=&endDate=&status=open|closed
router.get('/', async (req: Request, res: Response) => {
  const { groupId, date, startDate, endDate, status } = req.query as {
    groupId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  };

  const filter: Record<string, unknown> = {};
  if (groupId) filter.customerGroupId = groupId;
  if (status) filter.status = status;

  if (date) {
    const d = new Date(`${date}T00:00:00+07:00`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    filter.date = { $gte: d, $lt: next };
  } else if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.$gte = new Date(`${startDate}T00:00:00+07:00`);
    if (endDate) range.$lte = new Date(`${endDate}T23:59:59+07:00`);
    filter.date = range;
  }

  const conversations = await Conversation.find(filter)
    .populate('customerGroupId', 'name')
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .lean();

  res.json(conversations);
});

const SLOW_RESPONSE_MS  = 15 * 60 * 1000; // 15 minutes
const EPOCH = new Date(0);

// GET /api/v1/conversations/grouped?responseStatus=slow|normal&page=1&limit=20
// Returns one conversation per group (most recent), LINE-style
router.get('/grouped', async (req: Request, res: Response) => {
  const { responseStatus, page: pageStr, limit: limitStr } = req.query as {
    responseStatus?: string;
    page?: string;
    limit?: string;
  };

  const limit = Math.min(Number(limitStr) || 20, 50);
  const page  = Math.max(Number(pageStr)  || 1, 1);
  const skip  = (page - 1) * limit;

  const now = new Date();
  const slowThreshold = new Date(now.getTime() - SLOW_RESPONSE_MS);

  const pipeline: object[] = [
    // Use index { lastMessageAt: -1 }
    { $sort: { lastMessageAt: -1 } },
    // Only open conversations for response-status logic
    { $match: { status: 'open' } },
    // Keep only the latest conversation per group
    {
      $group: {
        _id: '$customerGroupId',
        convId:                 { $first: '$_id' },
        lineGroupId:            { $first: '$lineGroupId' },
        date:                   { $first: '$date' },
        startedAt:              { $first: '$startedAt' },
        lastMessageAt:          { $first: '$lastMessageAt' },
        status:                 { $first: '$status' },
        messageCount:           { $first: '$messageCount' },
        customerMessageCount:   { $first: '$customerMessageCount' },
        employeeMessageCount:   { $first: '$employeeMessageCount' },
        firstResponseMs:        { $first: '$firstResponseMs' },
        avgResponseMs:          { $first: '$avgResponseMs' },
        lastCustomerMessageAt:    { $first: '$lastCustomerMessageAt' },
        lastEmployeeMessageAt:    { $first: '$lastEmployeeMessageAt' },
        responseStatusOverride:   { $first: '$responseStatusOverride' },
      },
    },
    // Compute responseStatus (3 states):
    // normal   = override set, OR employee replied last
    // waiting  = customer messaged last, < 15 min
    // slow     = customer messaged last, > 15 min
    {
      $addFields: {
        _customerLast: {
          $gt: [
            '$lastCustomerMessageAt',
            { $ifNull: ['$lastEmployeeMessageAt', EPOCH] },
          ],
        },
      },
    },
    {
      $addFields: {
        responseStatus: {
          $switch: {
            branches: [
              // Manual override always wins
              {
                case: { $eq: ['$responseStatusOverride', 'normal'] },
                then: 'normal',
              },
              // Customer messaged last AND waited > 15 min → slow
              {
                case: {
                  $and: [
                    '$_customerLast',
                    { $lte: ['$lastCustomerMessageAt', slowThreshold] },
                  ],
                },
                then: 'slow',
              },
              // Customer messaged last AND < 15 min → waiting
              {
                case: '$_customerLast',
                then: 'waiting',
              },
            ],
            default: 'normal',
          },
        },
      },
    },
    { $sort: { lastMessageAt: -1 } },
    // Filter by responseStatus if requested
    ...(responseStatus ? [{ $match: { responseStatus } }] : []),
    // Pagination with total count
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'customergroups',
              localField: '_id',
              foreignField: '_id',
              as: 'group',
            },
          },
          { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await (Conversation as any).aggregate(pipeline);
  const total = result.total[0]?.count ?? 0;

  res.json({
    data: result.data.map((d: any) => ({
      _id:     d.convId,
      customerGroupId: d.group
        ? { _id: String(d.group._id), name: d.group.name }
        : { _id: String(d._id), name: String(d._id) },
      lineGroupId:          d.lineGroupId,
      date:                 d.date,
      startedAt:            d.startedAt,
      lastMessageAt:        d.lastMessageAt,
      status:               d.status,
      responseStatus:       d.responseStatus,
      lastCustomerMessageAt: d.lastCustomerMessageAt,
      lastEmployeeMessageAt: d.lastEmployeeMessageAt,
      messageCount:         d.messageCount,
      customerMessageCount: d.customerMessageCount,
      employeeMessageCount: d.employeeMessageCount,
      firstResponseMs:           d.firstResponseMs,
      avgResponseMs:             d.avgResponseMs,
      responseStatusOverride:    d.responseStatusOverride,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// PATCH /api/v1/conversations/:id  — manual override responseStatus
router.patch('/:id', async (req: Request, res: Response) => {
  const { responseStatusOverride } = req.body as { responseStatusOverride: 'normal' | null };

  if (responseStatusOverride !== 'normal' && responseStatusOverride !== null) {
    res.status(400).json({ error: 'responseStatusOverride must be "normal" or null' });
    return;
  }

  const conv = await Conversation.findByIdAndUpdate(
    req.params.id,
    { $set: { responseStatusOverride } },
    { new: true }
  ).lean();

  if (!conv) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ ok: true });
});

// GET /api/v1/conversations/:id
router.get('/:id', async (req: Request, res: Response) => {
  const conversation = await Conversation.findById(req.params.id)
    .populate('customerGroupId', 'name')
    .lean();

  if (!conversation) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(conversation);
});

export { router as conversationRoutes };
