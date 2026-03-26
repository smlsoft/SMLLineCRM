import type { PermissionKey } from '../models/PermissionGroup';

export interface JwtPayload {
  sub: string;            // AdminUser._id
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
  iat?: number;
  exp?: number;
}

// Extend Express Request type to include adminUser
declare global {
  namespace Express {
    interface Request {
      adminUser?: JwtPayload;
    }
  }
}
