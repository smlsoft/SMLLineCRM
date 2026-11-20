import { Router, Request, Response } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { CustomerGroup } from '../../models/CustomerGroup';
import { Employee } from '../../models/Employee';
import { TriageQueueItem } from '../../models/TriageQueueItem';
import { AutoResolveLog } from '../../models/AutoResolveLog';

type TriageStatus = 'queued' | 'needs_reply' | 'resolved_pending_review' | null;

// Group-level precedence: the most actionable state wins.
const TRIAGE_RANK: Record<Exclude<TriageStatus, null>, number> = {
  needs_reply: 3,
  queued: 2,
  resolved_pending_review: 1,
};

interface MonitorConvRow {
  _id: Types.ObjectId;
  responseStatus: string;
  lastCustomerMessageAt?: Date | null;
  triageStatus?: TriageStatus;
}

interface MonitorGroupRow {
  conversations: MonitorConvRow[];
  triageStatus?: TriageStatus;
}

/**
 * Adds triageStatus to each pending conversation and its group, using only
 * queue items / logs for the conversation's current customer-message snapshot.
 */
async function attachTriageStatus(groups: MonitorGroupRow[]): Promise<void> {
  const pending = groups.flatMap((g) =>
    g.conversations.filter(
      (c) => (c.responseStatus === 'slow' || c.responseStatus === 'waiting') && c.lastCustomerMessageAt
    )
  );
  const key = (id: Types.ObjectId | string, at: Date) => `${String(id)}|${new Date(at).getTime()}`;
  const ids = pending.map((c) => c._id);

  const [items, logs] = ids.length
    ? await Promise.all([
        TriageQueueItem.find({
          conversationId: { $in: ids },
          $or: [{ status: { $in: ['pending', 'claimed'] } }, { status: 'done', verdict: 'needs_reply' }],
        })
          .select('conversationId lastMessageAtSnapshot status verdict')
          .lean(),
        AutoResolveLog.find({ conversationId: { $in: ids }, status: 'pending_review' })
          .select('conversationId lastMessageAtSnapshot')
          .lean(),
      ])
    : [[], []];

  const byKey = new Map<string, Exclude<TriageStatus, null>>();
  const put = (k: string, v: Exclude<TriageStatus, null>) => {
    const cur = byKey.get(k);
    if (!cur || TRIAGE_RANK[v] > TRIAGE_RANK[cur]) byKey.set(k, v);
  };
  for (const it of items) {
    put(key(it.conversationId, it.lastMessageAtSnapshot), it.status === 'done' ? 'needs_reply' : 'queued');
  }
  for (const lg of logs) {
    put(key(lg.conversationId, lg.lastMessageAtSnapshot), 'resolved_pending_review');
  }

  for (const g of groups) {
    let groupStatus: TriageStatus = null;
    for (const c of g.conversations) {
      const st =
        (c.responseStatus === 'slow' || c.responseStatus === 'waiting') && c.lastCustomerMessageAt
          ? byKey.get(key(c._id, c.lastCustomerMessageAt)) ?? null
          : null;
      c.triageStatus = st;
      if (st && (!groupStatus || TRIAGE_RANK[st] > TRIAGE_RANK[groupStatus])) groupStatus = st;
    }
    g.triageStatus = groupStatus;
  }
}

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

    // Stage 2: Join open conversations — today OR older ones still awaiting customer response
    {
      $lookup: {
        from: 'conversations',
        let: { gid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$customerGroupId', '$$gid'] },
                  {
                    $or: [
                      // บทสนทนาวันนี้ (ทุกสถานะ)
                      { $and: [{ $gte: ['$date', todayStart] }, { $lt: ['$date', todayEnd] }] },
                      // บทสนทนาเก่าที่ลูกค้าทักมาแต่ยังไม่มีพนักงานตอบ
                      {
                        $and: [
                          { $lt: ['$date', todayStart] },
                          { $gt: [
                            { $ifNull: ['$lastCustomerMessageAt', EPOCH] },
                            { $ifNull: ['$lastEmployeeMessageAt', EPOCH] },
                          ]},
                          { $ne: ['$responseStatusOverride', 'normal'] },
                        ],
                      },
                    ],
                  },
                ],
              },
              status: 'open',
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

  const results = await CustomerGroup.aggregate<MonitorGroupRow>(pipeline);
  await attachTriageStatus(results);
  res.json(results);
});

// GET /api/v1/monitor/employees
// Returns all active employees with their last response time today and availability status
router.get('/employees', async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(`${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}T00:00:00+07:00`);
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const pipeline: PipelineStage[] = [
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'messages',
        let: { empId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$employeeId', '$$empId'] },
              senderType: 'employee',
              timestamp: { $gte: todayStart, $lt: todayEnd },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, timestamp: 1, customerGroupId: 1 } },
        ],
        as: '_lastMsg',
      },
    },
    {
      $addFields: {
        _lastMsgDoc: { $arrayElemAt: ['$_lastMsg', 0] },
      },
    },
    {
      $addFields: {
        lastResponseAt: { $ifNull: ['$_lastMsgDoc.timestamp', null] },
        _lastGroupId: { $ifNull: ['$_lastMsgDoc.customerGroupId', null] },
        idleMinutes: {
          $cond: {
            if: { $gt: ['$_lastMsgDoc.timestamp', null] },
            then: { $divide: [{ $subtract: [now, '$_lastMsgDoc.timestamp'] }, 60000] },
            else: null,
          },
        },
      },
    },
    {
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $eq: ['$_lastMsgDoc', null] }, then: 'away' },
              { case: { $lt: [{ $divide: [{ $subtract: [now, '$_lastMsgDoc.timestamp'] }, 60000] }, 30] }, then: 'active' },
              { case: { $lt: [{ $divide: [{ $subtract: [now, '$_lastMsgDoc.timestamp'] }, 60000] }, 120] }, then: 'idle' },
            ],
            default: 'away',
          },
        },
      },
    },
    {
      $lookup: {
        from: 'customergroups',
        localField: '_lastGroupId',
        foreignField: '_id',
        as: '_groupDoc',
      },
    },
    {
      $addFields: {
        lastResponseGroupId: { $ifNull: ['$_lastGroupId', null] },
        lastResponseGroupName: { $ifNull: [{ $arrayElemAt: ['$_groupDoc.name', 0] }, null] },
        _sortTier: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', 'active'] }, then: 0 },
              { case: { $eq: ['$status', 'idle'] },   then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    { $sort: { _sortTier: 1 as const, idleMinutes: 1 as const } },
    { $unset: ['_sortTier', '_lastMsg', '_lastMsgDoc', '_lastGroupId', '_groupDoc'] },
    {
      $project: {
        _id: 1, name: 1, employeeCode: 1, department: 1,
        lastResponseAt: 1, lastResponseGroupId: 1, lastResponseGroupName: 1, idleMinutes: 1, status: 1,
      },
    },
  ];

  const results = await Employee.aggregate(pipeline);
  res.json(results);
});

export { router as monitorRoutes };
