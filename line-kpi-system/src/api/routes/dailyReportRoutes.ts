import { Router, Request, Response } from 'express';
import { DailyReport } from '../../models/DailyReport';
import { Conversation } from '../../models/Conversation';
import { CustomerGroup } from '../../models/CustomerGroup';
import { Employee } from '../../models/Employee';
import { DailyAnalysisJob, getRunState } from '../../jobs/DailyAnalysisJob';

const router = Router();
const job = new DailyAnalysisJob();

// GET /api/v1/daily-report?date=YYYY-MM-DD
// Returns DailyReport summary for the given date
router.get('/', async (req: Request, res: Response) => {
  const dateStr = (req.query['date'] as string) ?? new Date().toISOString().slice(0, 10);
  const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dateEnd   = new Date(`${dateStr}T23:59:59.999Z`);

  const report = await DailyReport.findOne({ date: { $gte: dateStart, $lte: dateEnd } }).lean();
  res.json(report ?? null);
});

// GET /api/v1/daily-report/jobs?date=&groupId=&category=&employeeId=&sort=&page=&limit=
// Paginated list of Conversations with filters
router.get('/jobs', async (req: Request, res: Response) => {
  const {
    date,
    groupId,
    category,
    employeeId,
    sort = 'startedAt',
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dateEnd   = new Date(`${dateStr}T23:59:59.999Z`);

  const filter: Record<string, unknown> = {
    date: { $gte: dateStart, $lte: dateEnd },
  };

  if (groupId) filter['customerGroupId'] = groupId;
  if (category) filter['issueCategory'] = category;
  if (employeeId) filter['participantEmployeeIds'] = employeeId;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const sortField = sort === 'groupName' ? 'customerGroupId' : 'startedAt';

  const [data, total] = await Promise.all([
    Conversation.find(filter)
      .populate('customerGroupId', 'name')
      .populate('participantEmployeeIds', 'name employeeCode')
      .sort({ [sortField]: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  res.json({
    data,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /api/v1/daily-report/filter-options?date=YYYY-MM-DD
// Returns distinct groups, categories, employees for filter dropdowns
router.get('/filter-options', async (req: Request, res: Response) => {
  const dateStr = (req.query['date'] as string) ?? new Date().toISOString().slice(0, 10);
  const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dateEnd   = new Date(`${dateStr}T23:59:59.999Z`);

  const dateFilter = { date: { $gte: dateStart, $lte: dateEnd } };

  const [groupIds, categories, employeeIds] = await Promise.all([
    Conversation.distinct('customerGroupId', dateFilter),
    Conversation.distinct('issueCategory', dateFilter),
    Conversation.distinct('participantEmployeeIds', dateFilter),
  ]);

  const [groups, employees] = await Promise.all([
    CustomerGroup.find({ _id: { $in: groupIds } }, 'name').lean(),
    Employee.find({ _id: { $in: employeeIds } }, 'name employeeCode').lean(),
  ]);

  res.json({
    groups: groups.map((g) => ({ _id: g._id, name: g.name })),
    categories: (categories as (string | null)[]).filter(Boolean),
    employees: employees.map((e) => ({ _id: e._id, name: e.name, employeeCode: e.employeeCode })),
  });
});

// GET /api/v1/daily-report/job-status
// Returns current in-memory run state
router.get('/job-status', (_req: Request, res: Response) => {
  res.json(getRunState());
});

// POST /api/v1/daily-report/trigger
// Body: { date?: string; force?: boolean }
router.post('/trigger', async (req: Request, res: Response) => {
  const { date, force = false } = req.body as { date?: string; force?: boolean };

  // Fire and forget
  job.runForDate(date, force).catch((err) =>
    console.error('[DailyReportRoutes] runForDate error:', err)
  );

  res.json({ ok: true, message: 'DailyAnalysisJob started', date: date ?? 'yesterday' });
});

export { router as dailyReportRoutes };
