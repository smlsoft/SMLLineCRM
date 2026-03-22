import { Router, Request, Response } from 'express';
import { LineOa } from '../../models/LineOa';
import { CustomerGroup } from '../../models/CustomerGroup';
import { oaRegistry } from '../../services/OaRegistry';
import { groupRegistry } from '../../services/GroupRegistry';

const router = Router();

// GET /api/v1/oas
router.get('/', async (_req: Request, res: Response) => {
  const oas = await LineOa.find().sort({ createdAt: -1 }).lean();
  const safe = oas.map(({ channelSecret: _, channelAccessToken: __, ...rest }) => rest);
  res.json(safe);
});

// GET /api/v1/oas/:id
router.get('/:id', async (req: Request, res: Response) => {
  const oa = await LineOa.findById(req.params.id).lean();
  if (!oa) { res.status(404).json({ error: 'Not found' }); return; }
  const { channelSecret: _, channelAccessToken: __, ...safe } = oa;
  res.json(safe);
});

// POST /api/v1/oas
router.post('/', async (req: Request, res: Response) => {
  const { channelId, channelSecret, channelAccessToken, displayName } = req.body as {
    channelId: string;
    channelSecret: string;
    channelAccessToken: string;
    displayName: string;
  };

  if (!channelId || !channelSecret || !channelAccessToken || !displayName) {
    res.status(400).json({ error: 'All fields are required: channelId, channelSecret, channelAccessToken, displayName' });
    return;
  }

  const oa = await LineOa.create({ channelId, channelSecret, channelAccessToken, displayName });
  await oaRegistry.refresh();
  res.status(201).json({ ...oa.toObject(), channelSecret: '***', channelAccessToken: '***' });
});

// PUT /api/v1/oas/:id
router.put('/:id', async (req: Request, res: Response) => {
  const oa = await LineOa.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!oa) { res.status(404).json({ error: 'Not found' }); return; }
  await oaRegistry.refresh();
  res.json({ message: 'Updated' });
});

// GET /api/v1/oas/groups/list  — list customer groups
router.get('/groups/list', async (_req: Request, res: Response) => {
  const groups = await CustomerGroup.find().sort({ createdAt: -1 }).lean();
  res.json(groups);
});

// POST /api/v1/oas/groups  — create a customer group
// lineGroupId is the LINE Group chat ID (e.g. "C1234abc") — get from server log after bot joins the group
router.post('/groups', async (req: Request, res: Response) => {
  const { name, description, lineGroupId, assignedOaId } = req.body as {
    name: string;
    description?: string;
    lineGroupId: string;
    assignedOaId?: string;
  };

  if (!name || !lineGroupId) {
    res.status(400).json({ error: 'name and lineGroupId are required' });
    return;
  }

  const group = await CustomerGroup.create({ name, description, lineGroupId, assignedOaId });
  await groupRegistry.refresh(); // keep in-memory routing cache in sync
  res.status(201).json(group);
});

// PUT /api/v1/oas/groups/:id  — update a customer group
router.put('/groups/:id', async (req: Request, res: Response) => {
  const group = await CustomerGroup.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!group) { res.status(404).json({ error: 'Not found' }); return; }
  await groupRegistry.refresh();
  res.json(group);
});

export { router as oaRoutes };
