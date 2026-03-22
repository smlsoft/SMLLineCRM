import { Schema, model, Document, Types } from 'mongoose';

export type KpiStatus = 'pending' | 'complete' | 'failed';

export interface IKpiRecord extends Document {
  employeeId: Types.ObjectId;
  customerGroupId: Types.ObjectId;
  date: Date;

  conversationsHandled: number;
  resolvedCases: number;
  messagesSent: number;
  avgFirstResponseMs?: number;
  avgResponseMs?: number;
  maxResponseMs?: number;
  firstResponseUnder5Min: number;
  firstResponseRate?: number;

  qualityScore?: number;
  kpiNarrative?: string;
  strengths: string[];
  areasToImprove: string[];

  aiProvider?: string;
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;

  status: KpiStatus;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

const kpiRecordSchema = new Schema<IKpiRecord>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    date: { type: Date, required: true },

    conversationsHandled: { type: Number, default: 0 },
    resolvedCases: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    avgFirstResponseMs: { type: Number },
    avgResponseMs: { type: Number },
    maxResponseMs: { type: Number },
    firstResponseUnder5Min: { type: Number, default: 0 },
    firstResponseRate: { type: Number },

    qualityScore: { type: Number, min: 1, max: 10 },
    kpiNarrative: { type: String },
    strengths: [{ type: String }],
    areasToImprove: [{ type: String }],

    aiProvider: { type: String },
    aiModel: { type: String },
    promptTokens: { type: Number },
    completionTokens: { type: Number },

    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// Primary retrieval + uniqueness per employee/group/day
kpiRecordSchema.index({ employeeId: 1, date: 1 }, { unique: true });
// Group-level KPI reports
kpiRecordSchema.index({ customerGroupId: 1, date: 1 });
// Cron idempotency
kpiRecordSchema.index({ date: 1, status: 1 });

export const KpiRecord = model<IKpiRecord>('KpiRecord', kpiRecordSchema);
