import { Schema, model, Document, Types } from 'mongoose';

export type ConversationStatus = 'open' | 'closed';

export interface ITranscriptEntry {
  senderDisplayName: string;
  senderType: 'employee' | 'customer';
  messageType: string;
  textContent?: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  customerGroupId: Types.ObjectId;
  lineGroupId: string;
  oaId: Types.ObjectId;
  date: Date;
  startedAt: Date;
  lastMessageAt: Date;
  status: ConversationStatus;

  participantCustomerIds: string[];
  participantEmployeeIds: Types.ObjectId[];

  messageCount: number;
  customerMessageCount: number;
  employeeMessageCount: number;

  lastCustomerMessageAt?: Date;
  lastEmployeeMessageAt?: Date;
  responseStatusOverride?: 'normal' | null;

  firstResponseAt?: Date;
  firstResponseMs?: number;
  avgResponseMs?: number;
  maxResponseMs?: number;

  issueCategory?: string;
  issueSummary?: string;

  tags: string[];
  transcript?: ITranscriptEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    lineGroupId: { type: String, required: true },
    oaId: { type: Schema.Types.ObjectId, ref: 'LineOa', required: true },
    date: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    lastMessageAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },

    participantCustomerIds: [{ type: String }],
    participantEmployeeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],

    messageCount: { type: Number, default: 0 },
    customerMessageCount: { type: Number, default: 0 },
    employeeMessageCount: { type: Number, default: 0 },

    lastCustomerMessageAt: { type: Date },
    lastEmployeeMessageAt: { type: Date },
    responseStatusOverride: { type: String, enum: ['normal', null], default: null },

    firstResponseAt: { type: Date },
    firstResponseMs: { type: Number },
    avgResponseMs: { type: Number },
    maxResponseMs: { type: Number },

    issueCategory: { type: String },
    issueSummary: { type: String },

    tags: [{ type: String }],
    transcript: {
      type: [
        new Schema<ITranscriptEntry>(
          {
            senderDisplayName: { type: String, required: true },
            senderType: { type: String, enum: ['employee', 'customer'], required: true },
            messageType: { type: String, required: true },
            textContent: { type: String },
            timestamp: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

// Thread lookup + gap detection
conversationSchema.index({ lineGroupId: 1, lastMessageAt: -1 });
// Nightly cron aggregation
conversationSchema.index({ customerGroupId: 1, date: 1 });
// Daily summary queries
conversationSchema.index({ date: 1, status: 1 });
// Per-employee KPI queries
conversationSchema.index({ participantEmployeeIds: 1, date: 1 });
// LINE-style grouped list — sort all by latest activity
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = model<IConversation>('Conversation', conversationSchema);
