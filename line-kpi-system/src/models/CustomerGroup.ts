import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomerGroup extends Document {
  name: string;
  description?: string;
  lineGroupId: string;
  assignedOaId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerGroupSchema = new Schema<ICustomerGroup>(
  {
    name: { type: String, required: true },
    description: { type: String },
    lineGroupId: { type: String, required: true, unique: true, index: true },
    assignedOaId: { type: Schema.Types.ObjectId, ref: 'LineOa', index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CustomerGroup = model<ICustomerGroup>('CustomerGroup', customerGroupSchema);
