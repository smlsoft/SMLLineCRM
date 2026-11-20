import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { AutoResolveLog } from '../models/AutoResolveLog';
import { TriageQueueItem } from '../models/TriageQueueItem';
import { SenderType } from '../models/Message';

interface UpdateParams {
  conversationId: Types.ObjectId;
  senderType: SenderType;
  employeeId?: Types.ObjectId;
  lineUserId: string;
  timestamp: Date;
  isFirstResponseFromEmployee: boolean;
  firstResponseMs?: number;
  responseGapMs?: number;
}

/**
 * Atomically updates denormalized metrics on a conversation document
 * after a message is processed. Uses $inc and $addToSet to avoid
 * read-modify-write races on concurrent messages.
 */
export class MetricsUpdater {
  async update(params: UpdateParams): Promise<void> {
    const {
      conversationId,
      senderType,
      employeeId,
      lineUserId,
      timestamp,
      isFirstResponseFromEmployee,
      firstResponseMs,
      responseGapMs,
    } = params;

    const inc: Record<string, number> = { messageCount: 1 };
    const addToSet: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};

    if (senderType === 'customer') {
      inc.customerMessageCount = 1;
      addToSet.participantCustomerIds = lineUserId;
      set.lastCustomerMessageAt = timestamp;
      set.responseStatusOverride = null;
    } else {
      inc.employeeMessageCount = 1;
      set.lastEmployeeMessageAt = timestamp;
      if (employeeId) {
        addToSet.participantEmployeeIds = employeeId;
      }

      if (isFirstResponseFromEmployee && firstResponseMs !== undefined) {
        set.firstResponseMs = firstResponseMs;
        set.firstResponseAt = new Date();
      }
    }

    const updateOp: Record<string, unknown> = { $inc: inc };
    if (Object.keys(addToSet).length) updateOp.$addToSet = addToSet;
    if (Object.keys(set).length) updateOp.$set = set;

    await Conversation.updateOne({ _id: conversationId }, updateOp);

    if (senderType === 'customer') {
      await AutoResolveLog.updateMany(
        {
          conversationId,
          status: 'pending_review',
          lastMessageAtSnapshot: { $lt: timestamp },
        },
        {
          $set: {
            status: 'expired',
            expiredReason: 'ลูกค้าส่งข้อความใหม่เข้ามาหลังระบบประเมิน',
          },
        }
      );
    }

    // Open Layer 2 queue items are about an older snapshot: a new customer message
    // makes them stale, an employee reply makes them unnecessary.
    await TriageQueueItem.updateMany(
      {
        conversationId,
        status: { $in: ['pending', 'claimed'] },
        lastMessageAtSnapshot: { $lt: timestamp },
      },
      {
        $set: {
          status: 'expired',
          expiredReason:
            senderType === 'customer'
              ? 'ลูกค้าส่งข้อความใหม่เข้ามาหลังเข้าคิว'
              : 'พนักงานตอบแล้ว',
        },
        $unset: { leaseUntil: 1 },
      }
    );

    // Update rolling avgResponseMs and maxResponseMs separately to keep atomic op clean
    if (responseGapMs !== undefined && senderType === 'employee') {
      await this.updateResponseTimeAverages(conversationId, responseGapMs);
    }
  }

  private async updateResponseTimeAverages(
    conversationId: Types.ObjectId,
    newGapMs: number
  ): Promise<void> {
    // Use a MongoDB aggregation pipeline update so the read-calculate-write
    // happens atomically on the server, eliminating race conditions when
    // multiple employee messages arrive in the same conversation concurrently.
    await Conversation.updateOne(
      { _id: conversationId },
      [
        {
          $set: {
            avgResponseMs: {
              $round: [
                {
                  $divide: [
                    {
                      $add: [
                        {
                          $multiply: [
                            { $ifNull: ['$avgResponseMs', 0] },
                            { $subtract: [{ $ifNull: ['$employeeMessageCount', 1] }, 1] },
                          ],
                        },
                        newGapMs,
                      ],
                    },
                    { $max: [{ $ifNull: ['$employeeMessageCount', 1] }, 1] },
                  ],
                },
              ],
            },
            maxResponseMs: { $max: [{ $ifNull: ['$maxResponseMs', 0] }, newGapMs] },
          },
        },
      ]
    );
  }
}
