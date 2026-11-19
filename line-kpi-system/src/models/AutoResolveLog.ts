import { Schema, model, Document, Types } from 'mongoose';

export type AutoResolveLayer = 'rule' | 'ai';

export type AutoResolveStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'auto_resolved'
  | 'reverted'
  | 'expired';

export interface IAutoResolveSnapshotMessage {
  senderType: 'employee' | 'customer';
  senderDisplayName: string;
  messageType: string;
  textContent?: string;
  timestamp: Date;
}

export interface IAutoResolveLog extends Document {
  conversationId: Types.ObjectId;
  customerGroupId: Types.ObjectId;
  lineGroupId: string;
  layer: AutoResolveLayer;
  ruleCode?: string;
  reason: string;
  confidence?: number;
  status: AutoResolveStatus;
  lastMessageAtSnapshot: Date;
  snapshotMessages: IAutoResolveSnapshotMessage[];
  proposedBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  revertedBy?: string;
  revertedAt?: Date;
  expiredReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const snapshotMessageSchema = new Schema<IAutoResolveSnapshotMessage>(
  {
    senderType: { type: String, enum: ['employee', 'customer'], required: true },
    senderDisplayName: { type: String, required: true },
    messageType: { type: String, required: true },
    textContent: { type: String },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const autoResolveLogSchema = new Schema<IAutoResolveLog>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    lineGroupId: { type: String, required: true },
    layer: { type: String, enum: ['rule', 'ai'], required: true },
    ruleCode: { type: String },
    reason: { type: String, required: true },
    confidence: { type: Number },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected', 'auto_resolved', 'reverted', 'expired'],
      default: 'pending_review',
      required: true,
    },
    lastMessageAtSnapshot: { type: Date, required: true },
    snapshotMessages: { type: [snapshotMessageSchema], default: [] },
    proposedBy: { type: String, default: 'smllinecrm-mcp' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
    revertedBy: { type: String },
    revertedAt: { type: Date },
    expiredReason: { type: String },
  },
  { timestamps: true }
);

autoResolveLogSchema.index({ status: 1, createdAt: -1 });
autoResolveLogSchema.index({ conversationId: 1, status: 1 });
autoResolveLogSchema.index({ customerGroupId: 1, createdAt: -1 });

export const AutoResolveLog = model<IAutoResolveLog>('AutoResolveLog', autoResolveLogSchema);
