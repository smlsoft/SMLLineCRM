import { Schema, model, Document, Types } from 'mongoose';

export type TriageQueueStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'expired';
export type TriageVerdict = 'resolved' | 'needs_reply';

export const TRIAGE_MAX_ATTEMPTS = 3;

/**
 * One urgent conversation that Layer 1 rules could not decide, waiting for the
 * external Layer 2 AI agent. Keyed by (conversationId, lastMessageAtSnapshot):
 * a new customer message produces a new snapshot and therefore a new item.
 */
export interface ITriageQueueItem extends Document {
  conversationId: Types.ObjectId;
  customerGroupId: Types.ObjectId;
  lineGroupId: string;
  lastMessageAtSnapshot: Date;
  status: TriageQueueStatus;
  enqueueReason?: string;
  enqueuedBy: string;
  claimedBy?: string;
  claimedAt?: Date;
  leaseUntil?: Date;
  attempts: number;
  lastError?: string;
  verdict?: TriageVerdict;
  verdictReason?: string;
  confidence?: number;
  autoResolveLogId?: Types.ObjectId;
  completedAt?: Date;
  expiredReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const triageQueueItemSchema = new Schema<ITriageQueueItem>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    lineGroupId: { type: String, required: true },
    lastMessageAtSnapshot: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'claimed', 'done', 'failed', 'expired'],
      default: 'pending',
      required: true,
    },
    enqueueReason: { type: String },
    enqueuedBy: { type: String, default: 'smllinecrm-mcp' },
    claimedBy: { type: String },
    claimedAt: { type: Date },
    leaseUntil: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    verdict: { type: String, enum: ['resolved', 'needs_reply'] },
    verdictReason: { type: String },
    confidence: { type: Number },
    autoResolveLogId: { type: Schema.Types.ObjectId, ref: 'AutoResolveLog' },
    completedAt: { type: Date },
    expiredReason: { type: String },
  },
  { timestamps: true }
);

// One item per customer-message snapshot of a conversation (dedupe on enqueue).
triageQueueItemSchema.index({ conversationId: 1, lastMessageAtSnapshot: 1 }, { unique: true });
// Claim order: oldest claimable first.
triageQueueItemSchema.index({ status: 1, createdAt: 1 });
triageQueueItemSchema.index({ status: 1, leaseUntil: 1 });

export const TriageQueueItem = model<ITriageQueueItem>('TriageQueueItem', triageQueueItemSchema);
