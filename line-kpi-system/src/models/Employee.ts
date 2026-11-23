import { Schema, model, Document, Types } from 'mongoose';

export interface IEmployee extends Document {
  lineUserId: string;
  name: string;
  employeeCode: string;
  department?: string;
  assignedGroupIds: Types.ObjectId[];
  isActive: boolean;
  /** Login name for the staff AI assistant app (lowercase, unique when set). */
  assistantUsername?: string;
  /** bcrypt hash; never selected unless asked for with +assistantPasswordHash. */
  assistantPasswordHash?: string;
  /** AES-256-GCM copy so managers can view it; never selected unless asked for. */
  assistantPasswordEnc?: string;
  assistantPasswordSetAt?: Date;
  assistantLoginEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    lineUserId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    employeeCode: { type: String, required: true, unique: true },
    department: { type: String },
    assignedGroupIds: [{ type: Schema.Types.ObjectId, ref: 'CustomerGroup' }],
    isActive: { type: Boolean, default: true, index: true },
    assistantUsername: { type: String, lowercase: true, trim: true },
    assistantPasswordHash: { type: String, select: false },
    assistantPasswordEnc: { type: String, select: false },
    assistantPasswordSetAt: { type: Date },
    assistantLoginEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

employeeSchema.index(
  { assistantUsername: 1 },
  { unique: true, partialFilterExpression: { assistantUsername: { $type: 'string' } } }
);

/** Fields only the assistant-login route may write. */
export const ASSISTANT_LOGIN_FIELDS = [
  'assistantUsername',
  'assistantPasswordHash',
  'assistantPasswordEnc',
  'assistantPasswordSetAt',
  'assistantLoginEnabled',
] as const;

export const Employee = model<IEmployee>('Employee', employeeSchema);
