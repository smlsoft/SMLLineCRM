import { Types } from 'mongoose';
import { Message } from '../models/Message';

/**
 * Finds the most recent unanswered customer message in a conversation
 * and returns the response gap in milliseconds.
 * Used to populate respondsToMessageId and responseGapMs on staff replies.
 */
export class ResponsePairer {
  async findLastUnansweredCustomerMessage(
    conversationId: Types.ObjectId,
    staffReplyTimestamp: Date
  ): Promise<{ messageId: Types.ObjectId; gapMs: number } | null> {
    // Find the last customer message before this staff reply that has no paired response yet
    const lastCustomerMsg = await Message.findOne({
      conversationId,
      senderType: 'customer',
      timestamp: { $lt: staffReplyTimestamp },
      respondsToMessageId: { $exists: false }, // not yet paired
    })
      .sort({ timestamp: -1 })
      .select('_id timestamp')
      .lean();

    if (!lastCustomerMsg) return null;

    const gapMs = staffReplyTimestamp.getTime() - lastCustomerMsg.timestamp.getTime();
    return { messageId: lastCustomerMsg._id as Types.ObjectId, gapMs };
  }
}
