import { Types } from 'mongoose';
import { masterIdCache } from '../services/MasterIdCache';
import { lineProfileService } from '../services/LineProfileService';
import { ConversationResolver } from './ConversationResolver';
import { ResponsePairer } from './ResponsePairer';
import { MetricsUpdater } from './MetricsUpdater';
import { Message, MessageType } from '../models/Message';
import { Conversation } from '../models/Conversation';

export interface IncomingMessage {
  lineMessageId: string;
  lineGroupId: string;
  lineUserId: string;
  oaId: string;
  oaAccessToken: string;
  customerGroupId: string;
  messageType: string;
  textContent?: string;
  timestamp: Date;
  rawEvent: Record<string, unknown>;
}

const resolver = new ConversationResolver();
const pairer = new ResponsePairer();
const updater = new MetricsUpdater();

export class MessageProcessor {
  async process(incoming: IncomingMessage): Promise<void> {
    const {
      lineMessageId,
      lineGroupId,
      lineUserId,
      oaId,
      oaAccessToken,
      customerGroupId,
      messageType,
      textContent,
      timestamp,
      rawEvent,
    } = incoming;

    // 1. Identify sender
    const employee = masterIdCache.getEmployee(lineUserId);
    const senderType = employee ? 'employee' : 'customer';
    const employeeId = employee ? new Types.ObjectId(employee._id) : undefined;

    // Fetch display name from LINE API (cached in MongoDB)
    const senderDisplayName = await lineProfileService.getDisplayName(
      lineUserId,
      lineGroupId,
      oaAccessToken
    );

    // 2. Resolve conversation thread
    const conversation = await resolver.resolve({
      lineGroupId,
      oaId,
      customerGroupId,
      timestamp,
    });
    const conversationId = conversation._id as Types.ObjectId;

    // 3. Determine response pairing (staff replies only)
    let respondsToMessageId: Types.ObjectId | undefined;
    let responseGapMs: number | undefined;

    if (senderType === 'employee') {
      const pair = await pairer.findLastUnansweredCustomerMessage(conversationId, timestamp);
      if (pair) {
        respondsToMessageId = pair.messageId;
        responseGapMs = pair.gapMs;
      }
    }

    // 4. Check if this is the first employee response in this conversation
    const isFirstResponseFromEmployee =
      senderType === 'employee' && !conversation.firstResponseAt;

    const firstResponseMs =
      isFirstResponseFromEmployee
        ? timestamp.getTime() - conversation.startedAt.getTime()
        : undefined;

    // 5. Persist message (idempotent — unique index on lineMessageId)
    try {
      await Message.create({
        conversationId,
        customerGroupId: new Types.ObjectId(customerGroupId),
        lineGroupId,
        oaId: new Types.ObjectId(oaId),
        lineMessageId,
        lineUserId,
        senderDisplayName,
        senderType,
        employeeId,
        messageType: normalizeMessageType(messageType),
        textContent,
        rawEvent,
        timestamp,
        receivedAt: new Date(),
        respondsToMessageId,
        responseGapMs,
      });
    } catch (err: unknown) {
      if (isMongoUniqueError(err)) {
        // Duplicate delivery from LINE retry — silently discard
        console.info(`[MessageProcessor] Duplicate message ignored: ${lineMessageId}`);
        return;
      }
      throw err;
    }

    // 6. Update conversation metrics atomically
    await updater.update({
      conversationId,
      senderType,
      employeeId,
      lineUserId,
      timestamp,
      isFirstResponseFromEmployee,
      firstResponseMs,
      responseGapMs,
    });
  }
}

function normalizeMessageType(raw: string): MessageType {
  const known: MessageType[] = ['text', 'image', 'sticker', 'file', 'audio', 'video', 'location'];
  return known.includes(raw as MessageType) ? (raw as MessageType) : 'other';
}

function isMongoUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  );
}
