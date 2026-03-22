import { Schema, model, Document, Types } from 'mongoose';

export interface IEmployee extends Document {
  lineUserId: string;
  name: string;
  employeeCode: string;
  department?: string;
  assignedGroupIds: Types.ObjectId[];
  isActive: boolean;
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
  },
  { timestamps: true }
);

export const Employee = model<IEmployee>('Employee', employeeSchema);
