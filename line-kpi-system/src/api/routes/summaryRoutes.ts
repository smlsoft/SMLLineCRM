import { Router, Request, Response } from 'express';
import { DailySummary } from '../../models/DailySummary';
import { DailyEvaluationJob } from '../../jobs/DailyEvaluationJob';

const router = Router();
const evaluationJob = new DailyEvaluationJob();

// GET /api/v1/summaries?groupId=&date=YYYY-MM-DD
router.get('/', async (req: Request, res: Response) => {
  const { groupId, date } = req.query as { groupId?: string; date?: string };

  const filter: Record<string, unknown> = {};
  if (groupId) filter.customerGroupId = groupId;
  if (date) {
    const d = new Date(`${date}T00:00:00+07:00`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    filter.date = { $gte: d, $lt: next };
  }

  const summaries = await DailySummary.find(filter)
    .populate('customerGroupId', 'name')
    .sort({ date: -1 })
    .lean();

  res.json(summaries);
});

// POST /api/v1/summaries/trigger  — manually trigger AI pipeline
router.post('/trigger', async (req: Request, res: Response) => {
  const { date } = req.body as { date?: string };
  const targetDate = date ? new Date(date) : new Date();

  // Respond immediately — job runs async
  res.json({ message: 'Evaluation triggered', date: targetDate.toISOString().split('T')[0] });

  evaluationJob.runForDate(targetDate).catch((err) => {
    console.error('[SummaryRoutes] Manual trigger failed:', err);
  });
});

export { router as summaryRoutes };
