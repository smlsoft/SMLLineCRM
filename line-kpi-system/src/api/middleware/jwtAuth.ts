import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import type { JwtPayload } from '../../types/auth';
import type { PermissionKey } from '../../models/PermissionGroup';

export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: no token provided' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.adminUser = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: token invalid or expired' });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.adminUser?.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden: superadmin only' });
    return;
  }
  next();
}

export function requirePermission(key: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.adminUser;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (user.isSuperAdmin || user.permissions.includes(key)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
  };
}
