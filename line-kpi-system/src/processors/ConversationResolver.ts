import { Types } from 'mongoose';
import { Conversation, IConversation } from '../models/Conversation';
import { CustomerGroup } from '../models/CustomerGroup';
import { config } from '../config';

const GAP_MS = config.conversationGapHours * 60 * 60 * 1000;
// 60-second tolerance window to absorb late webhook deliveries at thread boundaries
const BOUNDARY_TOLERANCE_MS = 60 * 1000;
// Tries per message before giving up when concurrent messages keep opening threads first
const MAX_ATTEMPTS = 5;

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

    const findActive = () =>
      Conversation.findOneAndUpdate(
        {
          lineGroupId,
          status: 'open',
          lastMessageAt: { $gte: cutoff },
        },
        { $set: { lastMessageAt: timestamp } },
        { sort: { lastMessageAt: -1 }, new: true }
      );

    const date = dayFloor(timestamp);

    // Each attempt: join the open thread within the gap window, else close the older open
    // threads and open a new one. The unique index (one open conversation per lineGroupId)
    // refuses the create when a concurrent message opened a thread first; starting over then
    // joins that thread, or closes it when it lies outside this message's gap window.
    let refused: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const existing = await findActive();
      if (existing) {
        return existing;
      }

      // Only threads older than the gap window: a thread a concurrent message opened a moment
      // ago must stay open so that message and this one share it.
      await Conversation.updateMany(
        { lineGroupId, status: 'open', lastMessageAt: { $lt: cutoff } },
        { $set: { status: 'closed' } }
      );

      try {
        return await Conversation.create({
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
      } catch (err: unknown) {
        if (!isMongoUniqueError(err)) throw err;
        refused = err;
      }
    }
    throw refused;
  }
}

function isMongoUniqueError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
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
