import { Schema, model, Document, Types } from 'mongoose';

export type SummaryStatus = 'pending' | 'complete' | 'failed';

export interface IDailySummary extends Document {
  customerGroupId: Types.ObjectId;
  date: Date;

  totalConversations: number;
  totalMessages: number;
  avgFirstResponseMs?: number;
  avgResponseMs?: number;

  summaryText?: string;
  topIssues: string[];
  sentimentScore?: number;

  aiProvider?: string;
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  generatedAt?: Date;

  status: SummaryStatus;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

const dailySummarySchema = new Schema<IDailySummary>(
  {
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    date: { type: Date, required: true },

    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    avgFirstResponseMs: { type: Number },
    avgResponseMs: { type: Number },

    summaryText: { type: String },
    topIssues: [{ type: String }],
    sentimentScore: { type: Number },

    aiProvider: { type: String },
    aiModel: { type: String },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    generatedAt: { type: Date },

    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// Primary retrieval + uniqueness
dailySummarySchema.index({ customerGroupId: 1, date: 1 }, { unique: true });
// Cron idempotency check
dailySummarySchema.index({ date: 1, status: 1 });

export const DailySummary = model<IDailySummary>('DailySummary', dailySummarySchema);
