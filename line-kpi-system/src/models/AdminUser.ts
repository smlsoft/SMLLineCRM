import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PermissionKey, ALL_PERMISSION_KEYS, IPermissionGroup } from './PermissionGroup';

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  displayName: string;
  groupId?: Types.ObjectId;
  additionalPermissions: PermissionKey[];
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'PermissionGroup', default: null },
    additionalPermissions: {
      type: [String],
      enum: ALL_PERMISSION_KEYS,
      default: [],
    },
    isSuperAdmin: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const AdminUser = model<IAdminUser>('AdminUser', AdminUserSchema);

export function getEffectivePermissions(
  user: IAdminUser,
  group: IPermissionGroup | null
): PermissionKey[] {
  if (user.isSuperAdmin) return [...ALL_PERMISSION_KEYS];
  const base = group?.permissions ?? [];
  const combined = new Set([...base, ...user.additionalPermissions]);
  return [...combined];
}

export async function seedSuperAdmin(): Promise<void> {
  const existing = await AdminUser.findOne({ isSuperAdmin: true });
  if (existing) return;

  const passwordHash = await bcrypt.hash('superadmin', 12);
  await AdminUser.create({
    username: 'superadmin',
    passwordHash,
    displayName: 'Super Admin',
    isSuperAdmin: true,
    isActive: true,
    additionalPermissions: [],
  });
  console.log('[AdminUser] Seeded default superadmin user');
}
