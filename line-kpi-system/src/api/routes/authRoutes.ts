import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminUser, getEffectivePermissions } from '../../models/AdminUser';
import { PermissionGroup } from '../../models/PermissionGroup';
import { config } from '../../config';
import { jwtAuth } from '../middleware/jwtAuth';

export const authRoutes = Router();

// POST /api/v1/auth/login
authRoutes.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const user = await AdminUser.findOne({ username: username.toLowerCase().trim() });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const group = user.groupId
      ? await PermissionGroup.findById(user.groupId)
      : null;

    const permissions = getEffectivePermissions(user, group);

    const payload = {
      sub: (user._id as unknown as { toString(): string }).toString(),
      username: user.username,
      displayName: user.displayName,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    res.json({
      token,
      user: {
        username: user.username,
        displayName: user.displayName,
        isSuperAdmin: user.isSuperAdmin,
        permissions,
      },
    });
  } catch (err) {
    console.error('[authRoutes] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout — stateless, cookie cleared by frontend proxy
authRoutes.post('/logout', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// GET /api/v1/auth/me — requires valid JWT
authRoutes.get('/me', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.adminUser!.sub).select('-passwordHash');
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    const group = user.groupId
      ? await PermissionGroup.findById(user.groupId)
      : null;

    const permissions = getEffectivePermissions(user, group);

    res.json({
      username: user.username,
      displayName: user.displayName,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
    });
  } catch (err) {
    console.error('[authRoutes] me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
