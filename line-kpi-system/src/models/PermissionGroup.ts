import { Schema, model, Document } from 'mongoose';

export type PermissionKey =
  | 'dashboard'
  | 'monitor'
  | 'groups'
  | 'oas'
  | 'employees'
  | 'summaries'
  | 'issue-categories'
  | 'conversations'
  | 'settings'
  | 'users'
  | 'permission-groups';

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'dashboard', 'monitor', 'groups', 'oas', 'employees',
  'summaries', 'issue-categories', 'conversations', 'settings',
  'users', 'permission-groups',
];

export interface IPermissionGroup extends Document {
  name: string;
  description?: string;
  permissions: PermissionKey[];
  createdAt: Date;
  updatedAt: Date;
}

const PermissionGroupSchema = new Schema<IPermissionGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    permissions: {
      type: [String],
      enum: ALL_PERMISSION_KEYS,
      default: [],
    },
  },
  { timestamps: true }
);

export const PermissionGroup = model<IPermissionGroup>('PermissionGroup', PermissionGroupSchema);
