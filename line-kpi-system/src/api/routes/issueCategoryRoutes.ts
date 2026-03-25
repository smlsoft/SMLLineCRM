import { Router, Request, Response } from 'express';
import { IssueCategoryMaster, seedIssueCategoryMaster } from '../../models/IssueCategoryMaster';

const router = Router();

// GET /api/v1/issue-categories
router.get('/', async (_req: Request, res: Response) => {
  await seedIssueCategoryMaster();
  const categories = await IssueCategoryMaster.find().sort({ name: 1 }).lean();
  res.json(categories);
});

// POST /api/v1/issue-categories
router.post('/', async (req: Request, res: Response) => {
  const { name, description, keywords } = req.body as {
    name: string;
    description?: string;
    keywords?: string[];
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const category = await IssueCategoryMaster.create({
    name: name.trim(),
    description,
    keywords: keywords ?? [],
    isActive: true,
  });

  res.status(201).json(category);
});

// PUT /api/v1/issue-categories/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, keywords, isActive } = req.body as {
    name?: string;
    description?: string;
    keywords?: string[];
    isActive?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (name !== undefined) update['name'] = name.trim();
  if (description !== undefined) update['description'] = description;
  if (keywords !== undefined) update['keywords'] = keywords;
  if (isActive !== undefined) update['isActive'] = isActive;

  const updated = await IssueCategoryMaster.findByIdAndUpdate(
    req.params['id'],
    { $set: update },
    { new: true }
  ).lean();

  if (!updated) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(updated);
});

// DELETE /api/v1/issue-categories/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  const updated = await IssueCategoryMaster.findByIdAndUpdate(
    req.params['id'],
    { $set: { isActive: false } },
    { new: true }
  ).lean();

  if (!updated) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true });
});

export { router as issueCategoryRoutes };
