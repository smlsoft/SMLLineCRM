import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { CustomerGroup } from '../../models/CustomerGroup';
import { Conversation } from '../../models/Conversation';

const router = Router();

const SLOW_RESPONSE_MS = 15 * 60 * 1000; // 15 minutes
const EPOCH = new Date(0);

// GET /api/v1/monitor
// Returns CustomerGroups that have open conversations today, with pending/response status
router.get('/', async (_req: Request, res: Response) => {
  const now = new Date();
  const slowThreshold = new Date(now.getTime() - SLOW_RESPONSE_MS);

  // Today's date range in Bangkok timezone (UTC+7)
  const todayStart = new Date(`${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}T00:00:00+07:00`);
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const pipeline = [
    // Stage 1: All active customer groups
    { $match: { isActive: true } },

    // Stage 2: Join open conversations for today per group
    {
      $lookup: {
        from: 'conversations',
        let: { gid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$customerGroupId', '$$gid'] },
              status: 'open',
              date: { $gte: todayStart, $lt: todayEnd },
            },
          },
        ],
        as: 'openConvs',
      },
    },

    // Stage 3: Tag each conversation with its responseStatus and pendingMs
    {
      $addFields: {
        convStatuses: {
          $map: {
            input: '$openConvs',
            as: 'c',
            in: {
              _id: '$$c._id',
              lastMessageAt: '$$c.lastMessageAt',
              lastCustomerMessageAt: '$$c.lastCustomerMessageAt',
              responseStatusOverride: '$$c.responseStatusOverride',
              resolutionStatus: '$$c.resolutionStatus',
              aiResolutionSuggestion: '$$c.aiResolutionSuggestion',
              participantEmployeeIds: '$$c.participantEmployeeIds',
              _customerLast: {
                $gt: [
                  { $ifNull: ['$$c.lastCustomerMessageAt', EPOCH] },
                  { $ifNull: ['$$c.lastEmployeeMessageAt', EPOCH] },
                ],
              },
              pendingMs: {
                $cond: {
                  if: {
                    $gt: [
                      { $ifNull: ['$$c.lastCustomerMessageAt', EPOCH] },
                      { $ifNull: ['$$c.lastEmployeeMessageAt', EPOCH] },
                    ],
                  },
                  then: { $subtract: [now, '$$c.lastCustomerMessageAt'] },
                  else: 0,
                },
              },
            },
          },
        },
      },
    },

    // Stage 4: Add responseStatus to each tagged conversation
    {
      $addFields: {
        convStatuses: {
          $map: {
            input: '$convStatuses',
            as: 'cs',
            in: {
              $mergeObjects: [
                '$$cs',
                {
                  responseStatus: {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ['$$cs.responseStatusOverride', 'normal'] },
                          then: 'normal',
                        },
                        {
                          case: {
                            $and: [
                              '$$cs._customerLast',
                              { $lte: ['$$cs.lastCustomerMessageAt', slowThreshold] },
                            ],
                          },
                          then: 'slow',
                        },
                        {
                          case: '$$cs._customerLast',
                          then: 'waiting',
                        },
                      ],
                      default: 'normal',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },

    // Stage 5: Compute per-group aggregate stats
    {
      $addFields: {
        slowCount: {
          $size: {
            $filter: {
              input: '$convStatuses',
              as: 'cs',
              cond: { $eq: ['$$cs.responseStatus', 'slow'] },
            },
          },
        },
        waitingCount: {
          $size: {
            $filter: {
              input: '$convStatuses',
              as: 'cs',
              cond: { $eq: ['$$cs.responseStatus', 'waiting'] },
            },
          },
        },
        oldestPendingMs: {
          $max: {
            $map: {
              input: {
                $filter: {
                  input: '$convStatuses',
                  as: 'cs',
                  cond: { $in: ['$$cs.responseStatus', ['slow', 'waiting']] },
                },
              },
              as: 'cs',
              in: '$$cs.pendingMs',
            },
          },
        },
        lastActivityAt: { $max: '$openConvs.lastMessageAt' },
      },
    },

    // Stage 5b: Keep only groups that have at least one open conversation today
    { $match: { $expr: { $gt: [{ $size: '$openConvs' }, 0] } } },

    // Stage 6: Derive group-level priority
    {
      $addFields: {
        priorityStatus: {
          $switch: {
            branches: [
              { case: { $gt: ['$slowCount', 0] }, then: 'urgent' },
              { case: { $gt: ['$waitingCount', 0] }, then: 'warning' },
            ],
            default: 'normal',
          },
        },
      },
    },

    // Stage 7: Join assigned active employees
    {
      $lookup: {
        from: 'employees',
        let: { gid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$$gid', '$assignedGroupIds'] },
              isActive: true,
            },
          },
          { $project: { _id: 1, name: 1, employeeCode: 1 } },
        ],
        as: 'assignedEmployees',
      },
    },

    // Stage 8: Shape final output
    {
      $project: {
        _id: 1,
        name: 1,
        lineGroupId: 1,
        isActive: 1,
        priorityStatus: 1,
        slowCount: 1,
        waitingCount: 1,
        openConvCount: { $size: '$openConvs' },
        oldestPendingMs: { $ifNull: ['$oldestPendingMs', null] },
        lastActivityAt: { $ifNull: ['$lastActivityAt', null] },
        assignedEmployees: 1,
        conversations: {
          $map: {
            input: '$convStatuses',
            as: 'cs',
            in: {
              _id: '$$cs._id',
              responseStatus: '$$cs.responseStatus',
              resolutionStatus: '$$cs.resolutionStatus',
              aiResolutionSuggestion: '$$cs.aiResolutionSuggestion',
              pendingMs: '$$cs.pendingMs',
              lastCustomerMessageAt: '$$cs.lastCustomerMessageAt',
              lastMessageAt: '$$cs.lastMessageAt',
              participantEmployeeIds: '$$cs.participantEmployeeIds',
            },
          },
        },
      },
    },

    // Stage 9: Add sort tier
    {
      $addFields: {
        _sortTier: {
          $switch: {
            branches: [
              { case: { $eq: ['$priorityStatus', 'urgent'] }, then: 0 },
              { case: { $eq: ['$priorityStatus', 'warning'] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },

    // Stage 10: Sort by priority rules
    {
      $sort: {
        _sortTier: 1 as const,
        slowCount: -1 as const,
        waitingCount: -1 as const,
        oldestPendingMs: -1 as const,
        lastActivityAt: -1 as const,
      },
    },

    // Stage 11: Remove internal fields
    { $unset: ['_sortTier'] },
  ];

  const results = await CustomerGroup.aggregate(pipeline);
  res.json(results);
});

// PATCH /api/v1/monitor/:conversationId/resolve
router.patch('/:conversationId/resolve', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { resolutionStatus } = req.body as { resolutionStatus: 'resolved' | 'unresolved' | 'pending' };

  if (!['resolved', 'unresolved', 'pending'].includes(resolutionStatus)) {
    res.status(400).json({ error: 'Invalid resolutionStatus' });
    return;
  }

  if (!Types.ObjectId.isValid(conversationId)) {
    res.status(400).json({ error: 'Invalid conversationId' });
    return;
  }

  const update: Record<string, unknown> = { resolutionStatus };
  if (resolutionStatus === 'resolved') {
    update.resolvedAt = new Date();
  } else {
    update.resolvedAt = null;
    update.resolvedBy = null;
  }

  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    { $set: update },
    { new: true }
  );

  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json({ _id: conv._id, resolutionStatus: conv.resolutionStatus, resolvedAt: conv.resolvedAt });
});

export { router as monitorRoutes };
