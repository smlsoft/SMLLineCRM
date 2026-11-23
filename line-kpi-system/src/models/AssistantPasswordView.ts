import { Schema, model, Document, Types } from 'mongoose';

export type AssistantPasswordViewOutcome =
  | 'shown'
  | 'denied' // no valid token, inactive manager, or no `employees` permission now
  | 'no_key' // ASSISTANT_PASSWORD_KEY not set
  | 'not_found' // no such employee
  | 'no_copy'; // nothing viewable (set before the feature, removed, or key changed)

/** One row for every attempt to reveal an employee's saved assistant password. */
export interface IAssistantPasswordView extends Document {
  employeeId: Types.ObjectId;
  employeeName?: string;
  outcome: AssistantPasswordViewOutcome;
  adminId?: string;
  viewedBy?: string;
  ip?: string;
  viewedAt: Date;
}

const schema = new Schema<IAssistantPasswordView>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  employeeName: { type: String },
  outcome: { type: String, enum: ['shown', 'denied', 'no_key', 'not_found', 'no_copy'], required: true },
  adminId: { type: String },
  viewedBy: { type: String },
  ip: { type: String },
  viewedAt: { type: Date, required: true, default: Date.now, index: true },
});

export const AssistantPasswordView = model<IAssistantPasswordView>('AssistantPasswordView', schema);
