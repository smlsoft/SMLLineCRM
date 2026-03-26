import { Router, Request, Response } from 'express';
import { PermissionGroup, ALL_PERMISSION_KEYS } from '../../models/PermissionGroup';
import { AdminUser } from '../../models/AdminUser';
import { requirePermission } from '../middleware/jwtAuth';

export const permissionGroupRoutes = Router();

// Requires 'permission-groups' permission (superadmin always allowed)
permissionGroupRoutes.use(requirePermission('permission-groups'));

// GET /api/v1/admin/permission-groups
permissionGroupRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const groups = await PermissionGroup.find().sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    console.error('[permissionGroupRoutes] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/permission-groups
permissionGroupRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body as {
      name?: string;
      description?: string;
      permissions?: string[];
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const group = await PermissionGroup.create({
      name: name.trim(),
      description: description?.trim(),
      permissions: permissions ?? [],
    });

    res.status(201).json(group);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      res.status(409).json({ error: 'Group name already exists' });
      return;
    }
    console.error('[permissionGroupRoutes] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/permission-groups/:id
permissionGroupRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const group = await PermissionGroup.findById(req.params.id);
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }

    const { name, description, permissions } = req.body as {
      name?: string;
      description?: string;
      permissions?: string[];
    };

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (permissions !== undefined) group.permissions = permissions as typeof group.permissions;

    await group.save();
    res.json(group);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      res.status(409).json({ error: 'Group name already exists' });
      return;
    }
    console.error('[permissionGroupRoutes] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/permission-groups/:id
permissionGroupRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const group = await PermissionGroup.findById(req.params.id);
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }

    // Block delete if any user is assigned to this group
    const userCount = await AdminUser.countDocuments({ groupId: group._id });
    if (userCount > 0) {
      res.status(409).json({ error: `Cannot delete: ${userCount} user(s) are assigned to this group` });
      return;
    }

    await group.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('[permissionGroupRoutes] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/permission-groups/all-keys
permissionGroupRoutes.get('/all-keys', (_req: Request, res: Response) => {
  res.json({ keys: ALL_PERMISSION_KEYS });
});
