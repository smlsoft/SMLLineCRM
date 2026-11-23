import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Employee } from '../../models/Employee';

const router = Router();

// Compared when the username is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

function parseBasic(header: string | undefined): { username: string; password: string } | null {
  const m = /^Basic\s+(\S+)$/i.exec(header ?? '');
  if (!m) return null;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return null;
  return { username: decoded.slice(0, i).trim().toLowerCase(), password: decoded.slice(i + 1) };
}

// POST /api/v1/assistant/auth/verify
// For the staff AI assistant app (server to server). Needs X-API-Key like every /api/v1 route, plus the
// employee's credentials as `Authorization: Basic base64(username:password)`.
// 200 → { _id, name, employeeCode }; 401 for any failure, without saying which part failed.
router.post('/verify', async (req: Request, res: Response) => {
  const creds = parseBasic(req.headers['authorization']);
  if (!creds || !creds.username || !creds.password) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const emp = await Employee.findOne({ assistantUsername: creds.username })
    .select('+assistantPasswordHash name employeeCode isActive assistantLoginEnabled')
    .lean();
  const ok = await bcrypt.compare(creds.password, emp?.assistantPasswordHash ?? DUMMY_HASH);

  if (!emp || !ok || !emp.isActive || !emp.assistantLoginEnabled) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  res.json({ _id: emp._id, name: emp.name, employeeCode: emp.employeeCode });
});

export { router as assistantAuthRoutes };
