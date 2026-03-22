import { Schema, model, Document, Types } from 'mongoose';

export type SenderType = 'employee' | 'customer';
export type MessageType = 'text' | 'image' | 'sticker' | 'file' | 'audio' | 'video' | 'location' | 'other';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  customerGroupId: Types.ObjectId;
  lineGroupId: string;
  oaId: Types.ObjectId;

  lineMessageId: string;
  lineUserId: string;
  senderDisplayName: string;
  senderType: SenderType;
  employeeId?: Types.ObjectId;

  messageType: MessageType;
  textContent?: string;
  rawEvent: Record<string, unknown>;

  timestamp: Date;
  receivedAt: Date;

  respondsToMessageId?: Types.ObjectId;
  responseGapMs?: number;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    lineGroupId: { type: String, required: true },
    oaId: { type: Schema.Types.ObjectId, ref: 'LineOa', required: true },

    lineMessageId: { type: String, required: true },
    lineUserId: { type: String, required: true },
    senderDisplayName: { type: String, required: true },
    senderType: { type: String, enum: ['employee', 'customer'], required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },

    messageType: {
      type: String,
      enum: ['text', 'image', 'sticker', 'file', 'audio', 'video', 'location', 'other'],
      required: true,
    },
    textContent: { type: String },
    rawEvent: { type: Schema.Types.Mixed, required: true },

    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, required: true },

    respondsToMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    responseGapMs: { type: Number },
  },
  { _id: true, timestamps: false }
);

// Idempotency guard
messageSchema.index({ lineMessageId: 1 }, { unique: true });
// Conversation replay
messageSchema.index({ conversationId: 1, timestamp: 1 });
// Per-group daily fetch for AI
messageSchema.index({ customerGroupId: 1, timestamp: 1 });
// Per-employee daily KPI
messageSchema.index({ employeeId: 1, timestamp: 1 });
// Audit trail per user
messageSchema.index({ lineUserId: 1, timestamp: 1 });

export const Message = model<IMessage>('Message', messageSchema);
