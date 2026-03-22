import { Router, Request, Response } from 'express';
import { IssueReport } from '../../models/IssueReport';
import { IssueAnalysisJob } from '../../jobs/IssueAnalysisJob';

const router = Router();
const issueJob = new IssueAnalysisJob();

// GET /api/v1/issue-reports?groupId=&date=YYYY-MM-DD&period=daily
router.get('/', async (req: Request, res: Response) => {
  const { groupId, date } = req.query as { groupId?: string; date?: string };

  const filter: Record<string, unknown> = {};
  if (groupId) filter.customerGroupId = groupId;
  if (date) {
    const d = new Date(`${date}T00:00:00+07:00`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    filter.date = { $gte: d, $lt: next };
  }

  const reports = await IssueReport.find(filter)
    .populate('customerGroupId', 'name')
    .sort({ date: -1 })
    .lean();

  res.json(reports);
});

// GET /api/v1/issue-reports/trend?groupId=&category=&weeks=4
router.get('/trend', async (req: Request, res: Response) => {
  const { groupId, category, weeks } = req.query as {
    groupId?: string;
    category?: string;
    weeks?: string;
  };

  const weeksBack = parseInt(weeks ?? '4', 10);
  const since = new Date();
  since.setDate(since.getDate() - weeksBack * 7);

  const filter: Record<string, unknown> = {
    status: 'complete',
    date: { $gte: since },
  };
  if (groupId) filter.customerGroupId = groupId;

  const reports = await IssueReport.find(filter)
    .populate('customerGroupId', 'name')
    .sort({ date: 1 })
    .lean();

  // If category filter, project only that category's data per day
  if (category) {
    const trend = reports.map((r) => {
      const cat = r.issueCategories.find((c) => c.category === category);
      return {
        date: r.date,
        group: (r.customerGroupId as { name?: string })?.name ?? r.customerGroupId,
        count: cat?.count ?? 0,
        percentage: cat?.percentage ?? 0,
      };
    });
    return res.json(trend);
  }

  res.json(reports);
});

// POST /api/v1/issue-reports/trigger — manually trigger analysis
router.post('/trigger', async (req: Request, res: Response) => {
  const { date } = req.body as { date?: string };
  const targetDate = date ? new Date(date) : new Date();

  res.json({ message: 'Issue analysis triggered', date: targetDate.toISOString().split('T')[0] });

  issueJob.runForDate(targetDate).catch((err) => {
    console.error('[IssueRoutes] Manual trigger failed:', err);
  });
});

export { router as issueRoutes };
