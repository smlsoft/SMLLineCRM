import { Schema, model, Document, Types } from 'mongoose';

/** One row each time a manager reveals an employee's saved assistant password. */
export interface IAssistantPasswordView extends Document {
  employeeId: Types.ObjectId;
  employeeName: string;
  viewedBy: string;
  viewedAt: Date;
}

const schema = new Schema<IAssistantPasswordView>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  employeeName: { type: String, required: true },
  viewedBy: { type: String, required: true },
  viewedAt: { type: Date, required: true, default: Date.now, index: true },
});

export const AssistantPasswordView = model<IAssistantPasswordView>('AssistantPasswordView', schema);
