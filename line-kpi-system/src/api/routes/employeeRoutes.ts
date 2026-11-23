import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
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

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt reads only the first 72 bytes; a longer password would be silently cut.
const MAX_PASSWORD_BYTES = 72;

// PUT /api/v1/employees/:id/assistant-login
// Sets the AI assistant app login. Body: { username?, password?, enabled? } (each optional).
// Login can be turned on only when the employee has both a username and a password.
router.put('/:id/assistant-login', async (req: Request, res: Response) => {
  const { username, password, enabled } = (req.body ?? {}) as {
    username?: unknown;
    password?: unknown;
    enabled?: unknown;
  };

  const emp = await Employee.findById(req.params.id).select('+assistantPasswordHash');
  if (!emp) { res.status(404).json({ error: 'Not found' }); return; }

  if (username !== undefined) {
    const u = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!USERNAME_RE.test(u)) {
      res.status(400).json({ error: 'ชื่อผู้ใช้ต้องยาว 3-32 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ -' });
      return;
    }
    const taken = await Employee.exists({ assistantUsername: u, _id: { $ne: emp._id } });
    if (taken) { res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีพนักงานคนอื่นใช้แล้ว' }); return; }
    emp.assistantUsername = u;
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` });
      return;
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      res.status(400).json({ error: `รหัสผ่านยาวเกินไป (สูงสุด ${MAX_PASSWORD_BYTES} ไบต์ ประมาณ ${MAX_PASSWORD_BYTES} ตัวอักษรภาษาอังกฤษ)` });
      return;
    }
    emp.assistantPasswordHash = await bcrypt.hash(password, 12);
    emp.assistantPasswordSetAt = new Date();
  }

  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') { res.status(400).json({ error: 'enabled must be true or false' }); return; }
    if (enabled && (!emp.assistantUsername || !emp.assistantPasswordHash)) {
      res.status(400).json({ error: 'ต้องตั้งชื่อผู้ใช้และรหัสผ่านก่อนเปิดสิทธิ์' });
      return;
    }
    emp.assistantLoginEnabled = enabled;
  }

  try {
    await emp.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีพนักงานคนอื่นใช้แล้ว' });
      return;
    }
    throw err;
  }

  const out = emp.toObject();
  delete out.assistantPasswordHash;
  res.json(out);
});

const EDITABLE_FIELDS = ['lineUserId', 'name', 'employeeCode', 'department', 'assignedGroupIds', 'isActive'] as const;

// PUT /api/v1/employees/:id
router.put('/:id', async (req: Request, res: Response) => {
  // Only these fields can change here. Anything else, including update operators like `$set` and
  // dotted paths, is dropped, so the assistant login fields change only through /:id/assistant-login.
  const input = (req.body ?? {}) as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, f)) body[f] = input[f];
  }
  const emp = await Employee.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
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
