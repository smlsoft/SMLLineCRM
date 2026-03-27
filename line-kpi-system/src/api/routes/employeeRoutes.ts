import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Employee } from '../../models/Employee';
import { masterIdCache } from '../../services/MasterIdCache';
import { reclassifyEmployeeMessages } from '../../services/EmployeeReclassifier';

const router = Router();

// GET /api/v1/employees
router.get('/', async (_req: Request, res: Response) => {
  const employees = await Employee.find().sort({ createdAt: -1 }).lean();
  res.json(employees);
});

// GET /api/v1/employees/:id
router.get('/:id', async (req: Request, res: Response) => {
  const emp = await Employee.findById(req.params.id).lean();
  if (!emp) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(emp);
});

// POST /api/v1/employees
router.post('/', async (req: Request, res: Response) => {
  const { lineUserId, name, employeeCode, department, assignedGroupIds } = req.body as {
    lineUserId: string;
    name: string;
    employeeCode: string;
    department?: string;
    assignedGroupIds?: string[];
  };

  if (!lineUserId || !name || !employeeCode) {
    res.status(400).json({ error: 'lineUserId, name, and employeeCode are required' });
    return;
  }

  const emp = await Employee.create({ lineUserId, name, employeeCode, department, assignedGroupIds });
  await masterIdCache.refresh();
  // Re-classify messages วันนี้ที่อาจถูกเก็บเป็น 'customer' ขณะที่ยังไม่มีพนักงานนี้ในระบบ
  reclassifyEmployeeMessages(lineUserId, emp._id as Types.ObjectId).catch((err) =>
    console.warn('[employeeRoutes] reclassify failed:', err)
  );
  res.status(201).json(emp);
});

// PUT /api/v1/employees/:id
router.put('/:id', async (req: Request, res: Response) => {
  const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!emp) { res.status(404).json({ error: 'Not found' }); return; }
  await masterIdCache.refresh();
  // Re-classify ในกรณีที่ cache ล้าหลัง หรือ lineUserId เพิ่งถูกแก้ไข
  reclassifyEmployeeMessages(emp.lineUserId, emp._id as Types.ObjectId).catch((err) =>
    console.warn('[employeeRoutes] reclassify failed:', err)
  );
  res.json(emp);
});

// DELETE /api/v1/employees/:id  (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  const emp = await Employee.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!emp) { res.status(404).json({ error: 'Not found' }); return; }
  await masterIdCache.refresh();
  res.json({ message: 'Deactivated', employee: emp });
});

export { router as employeeRoutes };
