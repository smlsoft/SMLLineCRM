import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser, getEffectivePermissions } from '../../models/AdminUser';
import { PermissionGroup, PermissionKey, ALL_PERMISSION_KEYS } from '../../models/PermissionGroup';
import { requirePermission } from '../middleware/jwtAuth';

export const adminUserRoutes = Router();

// Requires 'users' permission (superadmin always allowed)
adminUserRoutes.use(requirePermission('users'));

// GET /api/v1/admin/users
adminUserRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await AdminUser.find().select('-passwordHash').populate('groupId', 'name permissions').sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    console.error('[adminUserRoutes] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users
adminUserRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, groupId, additionalPermissions } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      groupId?: string;
      additionalPermissions?: PermissionKey[];
    };

    if (!username || !password || !displayName) {
      res.status(400).json({ error: 'username, password, and displayName are required' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await AdminUser.create({
      username: username.toLowerCase().trim(),
      passwordHash,
      displayName: displayName.trim(),
      groupId: groupId || null,
      additionalPermissions: additionalPermissions ?? [],
      isSuperAdmin: false,
      isActive: true,
    });

    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.passwordHash;
    res.status(201).json(userObj);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    console.error('[adminUserRoutes] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/users/:id
adminUserRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.params.id).select('-passwordHash').populate('groupId', 'name permissions');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error('[adminUserRoutes] get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/users/:id
adminUserRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { displayName, groupId, additionalPermissions, isActive } = req.body as {
      displayName?: string;
      groupId?: string | null;
      additionalPermissions?: PermissionKey[];
      isActive?: boolean;
    };

    // Block deactivating superadmin
    if (user.isSuperAdmin && isActive === false) {
      res.status(403).json({ error: 'Cannot deactivate superadmin' });
      return;
    }

    if (displayName !== undefined) user.displayName = displayName.trim();
    if (groupId !== undefined) user.groupId = groupId ? (groupId as unknown as typeof user.groupId) : undefined;
    if (additionalPermissions !== undefined) user.additionalPermissions = additionalPermissions;
    if (!user.isSuperAdmin && isActive !== undefined) user.isActive = isActive;

    await user.save();

    const updated = await AdminUser.findById(user._id).select('-passwordHash').populate('groupId', 'name permissions');
    res.json(updated);
  } catch (err) {
    console.error('[adminUserRoutes] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/password — force reset
adminUserRoutes.post('/:id/password', async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'newPassword must be at least 6 characters' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUserRoutes] password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/users/:id
adminUserRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.isSuperAdmin) {
      res.status(403).json({ error: 'Cannot delete superadmin' });
      return;
    }

    await user.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUserRoutes] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/users/:id/effective-permissions
adminUserRoutes.get('/:id/effective-permissions', async (req: Request, res: Response) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const group = user.groupId ? await PermissionGroup.findById(user.groupId) : null;
    const permissions = getEffectivePermissions(user, group);
    res.json({ permissions, allKeys: ALL_PERMISSION_KEYS });
  } catch (err) {
    console.error('[adminUserRoutes] effective-permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
