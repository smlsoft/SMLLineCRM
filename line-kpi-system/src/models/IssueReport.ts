import { Schema, model, Document, Types } from 'mongoose';

export type IssueReportStatus = 'pending' | 'complete' | 'failed';
export type IssueTrend = 'up' | 'down' | 'stable' | 'new';

export interface IIssueCategory {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
  trend: IssueTrend;
}

export interface IIssueReport extends Document {
  customerGroupId: Types.ObjectId;
  date: Date;

  issueCategories: IIssueCategory[];
  recurringIssues: string[];
  emergingIssues: string[];
  rootCauseInsight?: string;
  recommendedActions: string[];

  aiProvider?: string;
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  generatedAt?: Date;

  status: IssueReportStatus;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

const issueCategorySchema = new Schema<IIssueCategory>(
  {
    category: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true },
    examples: [{ type: String }],
    trend: { type: String, enum: ['up', 'down', 'stable', 'new'], required: true },
  },
  { _id: false }
);

const issueReportSchema = new Schema<IIssueReport>(
  {
    customerGroupId: { type: Schema.Types.ObjectId, ref: 'CustomerGroup', required: true },
    date: { type: Date, required: true },

    issueCategories: [issueCategorySchema],
    recurringIssues: [{ type: String }],
    emergingIssues: [{ type: String }],
    rootCauseInsight: { type: String },
    recommendedActions: [{ type: String }],

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

issueReportSchema.index({ customerGroupId: 1, date: 1 }, { unique: true });
issueReportSchema.index({ date: 1, status: 1 });

export const IssueReport = model<IIssueReport>('IssueReport', issueReportSchema);
