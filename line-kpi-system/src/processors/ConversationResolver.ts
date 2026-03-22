import { Types } from 'mongoose';
import { Conversation, IConversation } from '../models/Conversation';
import { CustomerGroup } from '../models/CustomerGroup';
import { config } from '../config';

const GAP_MS = config.conversationGapHours * 60 * 60 * 1000;
// 60-second tolerance window to absorb late webhook deliveries at thread boundaries
const BOUNDARY_TOLERANCE_MS = 60 * 1000;

/**
 * Resolves (or creates) the conversation thread for an incoming message.
 * Uses a gap-based heuristic: if the last message in this lineGroupId
 * was more than CONVERSATION_GAP_HOURS ago, a new thread begins.
 */
export class ConversationResolver {
  async resolve(params: {
    lineGroupId: string;
    oaId: string;
    customerGroupId: string;
    timestamp: Date;
  }): Promise<IConversation> {
    const { lineGroupId, oaId, customerGroupId, timestamp } = params;

    const cutoff = new Date(timestamp.getTime() - GAP_MS - BOUNDARY_TOLERANCE_MS);

    // Atomic findOneAndUpdate — find open thread within gap window
    const existing = await Conversation.findOneAndUpdate(
      {
        lineGroupId,
        status: 'open',
        lastMessageAt: { $gte: cutoff },
      },
      { $set: { lastMessageAt: timestamp } },
      { sort: { lastMessageAt: -1 }, new: true }
    );

    if (existing) {
      return existing;
    }

    // No active thread — create a new conversation
    const date = dayFloor(timestamp);

    const conv = await Conversation.create({
      customerGroupId: new Types.ObjectId(customerGroupId),
      lineGroupId,
      oaId: new Types.ObjectId(oaId),
      date,
      startedAt: timestamp,
      lastMessageAt: timestamp,
      status: 'open',
      participantCustomerIds: [],
      participantEmployeeIds: [],
      messageCount: 0,
      customerMessageCount: 0,
      employeeMessageCount: 0,
      tags: [],
    });

    return conv;
  }
}

/**
 * Returns midnight (00:00:00.000) of the given date in local timezone.
 * TZ env var controls which timezone is used (default: Asia/Bangkok via docker).
 */
function dayFloor(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
