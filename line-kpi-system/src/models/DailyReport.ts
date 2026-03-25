import { Schema, model, Document, Types } from 'mongoose';

export interface IEmployeeBreakdown {
  employeeId: Types.ObjectId;
  employeeName: string;
  messageCount: number;
}

export interface IIssueCategorySummary {
  category: string;
  count: number;
}

export interface IDailyReport extends Document {
  date: Date;                          // unique per day (date only, no time)
  groupCount: number;                  // number of groups with conversations
  jobCount: number;                    // total conversations processed
  totalMessages: number;
  customerMessages: number;
  employeeMessages: number;
  employeeBreakdown: IEmployeeBreakdown[];
  issueCategorySummary: IIssueCategorySummary[];
  status: 'pending' | 'complete' | 'failed';
  totalGroups: number;                 // groups to process (for progress display)
  processedGroups: number;             // groups processed so far
  aiProvider?: string;
  aiModel?: string;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const employeeBreakdownSchema = new Schema<IEmployeeBreakdown>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const issueCategorySummarySchema = new Schema<IIssueCategorySummary>(
  {
    category: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const dailyReportSchema = new Schema<IDailyReport>(
  {
    date: { type: Date, required: true, unique: true },
    groupCount: { type: Number, default: 0 },
    jobCount: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    customerMessages: { type: Number, default: 0 },
    employeeMessages: { type: Number, default: 0 },
    employeeBreakdown: { type: [employeeBreakdownSchema], default: [] },
    issueCategorySummary: { type: [issueCategorySummarySchema], default: [] },
    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' },
    totalGroups: { type: Number, default: 0 },
    processedGroups: { type: Number, default: 0 },
    aiProvider: { type: String },
    aiModel: { type: String },
    generatedAt: { type: Date },
  },
  { timestamps: true }
);

export const DailyReport = model<IDailyReport>('DailyReport', dailyReportSchema);
