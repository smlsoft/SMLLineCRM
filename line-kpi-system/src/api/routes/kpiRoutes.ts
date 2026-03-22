import { Router, Request, Response } from 'express';
import { KpiRecord } from '../../models/KpiRecord';

const router = Router();

// GET /api/v1/kpi/leaderboard?groupId=&startDate=&endDate=
// Ranks employees by composite score: qualityScore 50% + firstResponseRate 30% + conversationsHandled 20%
router.get('/leaderboard', async (req: Request, res: Response) => {
  const { groupId, startDate, endDate } = req.query as {
    groupId?: string;
    startDate?: string;
    endDate?: string;
  };

  const filter: Record<string, unknown> = { status: 'complete' };
  if (groupId) filter.customerGroupId = groupId;
  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.$gte = new Date(`${startDate}T00:00:00+07:00`);
    if (endDate) range.$lte = new Date(`${endDate}T23:59:59+07:00`);
    filter.date = range;
  }

  const records = await KpiRecord.find(filter)
    .populate('employeeId', 'name employeeCode department')
    .populate('customerGroupId', 'name')
    .lean();

  // Aggregate per employee
  const map = new Map<string, {
    employee: unknown;
    totalQuality: number;
    totalFirstResponseRate: number;
    totalConversations: number;
    totalResolvedCases: number;
    count: number;
  }>();

  for (const r of records) {
    const key = r.employeeId?.toString() ?? '';
    const entry = map.get(key) ?? {
      employee: r.employeeId,
      totalQuality: 0,
      totalFirstResponseRate: 0,
      totalConversations: 0,
      totalResolvedCases: 0,
      count: 0,
    };
    entry.totalQuality += r.qualityScore ?? 0;
    entry.totalFirstResponseRate += r.firstResponseRate ?? 0;
    entry.totalConversations += r.conversationsHandled ?? 0;
    entry.totalResolvedCases += r.resolvedCases ?? 0;
    entry.count += 1;
    map.set(key, entry);
  }

  const leaderboard = [...map.values()]
    .map((e) => {
      const avgQuality = e.totalQuality / e.count;
      const avgFirstResponseRate = e.totalFirstResponseRate / e.count;
      const avgConversations = e.totalConversations / e.count;
      const avgResolvedCases = e.totalResolvedCases / e.count;
      // resolvedCases is the primary metric: normalized 0-10 (cap at 10 cases = max)
      const normalizedResolved = Math.min(avgResolvedCases / 10, 1) * 10;
      const compositeScore =
        normalizedResolved * 0.6 +
        avgQuality * 0.3 +
        avgFirstResponseRate * 10 * 0.1;
      return {
        employee: e.employee,
        avgQualityScore: Math.round(avgQuality * 10) / 10,
        avgFirstResponseRate: Math.round(avgFirstResponseRate * 1000) / 1000,
        avgConversationsHandled: Math.round(avgConversations * 10) / 10,
        avgResolvedCases: Math.round(avgResolvedCases * 10) / 10,
        compositeScore: Math.round(compositeScore * 10) / 10,
        evaluationCount: e.count,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((e, i) => ({ rank: i + 1, ...e }));

  res.json(leaderboard);
});

// GET /api/v1/kpi/trend?employeeId=&groupId=&weeks=4
// Returns weekly averages for the past N weeks
router.get('/trend', async (req: Request, res: Response) => {
  const { employeeId, groupId, weeks } = req.query as {
    employeeId?: string;
    groupId?: string;
    weeks?: string;
  };

  const weeksBack = parseInt(weeks ?? '4', 10);
  const since = new Date();
  since.setDate(since.getDate() - weeksBack * 7);

  const filter: Record<string, unknown> = {
    status: 'complete',
    date: { $gte: since },
  };
  if (employeeId) filter.employeeId = employeeId;
  if (groupId) filter.customerGroupId = groupId;

  const records = await KpiRecord.find(filter)
    .populate('employeeId', 'name employeeCode')
    .sort({ date: 1 })
    .lean();

  // Group by ISO week
  const weekMap = new Map<string, {
    weekLabel: string;
    weekStart: Date;
    qualityScores: number[];
    responseTimes: number[];
    firstResponseRates: number[];
    conversations: number[];
    resolvedCasesList: number[];
  }>();

  for (const r of records) {
    const weekStart = getWeekStart(r.date as Date);
    const key = weekStart.toISOString().split('T')[0];
    const entry = weekMap.get(key) ?? {
      weekLabel: key,
      weekStart,
      qualityScores: [],
      responseTimes: [],
      firstResponseRates: [],
      conversations: [],
      resolvedCasesList: [],
    };
    if (r.qualityScore !== undefined) entry.qualityScores.push(r.qualityScore);
    if (r.avgResponseMs !== undefined) entry.responseTimes.push(r.avgResponseMs);
    if (r.firstResponseRate !== undefined) entry.firstResponseRates.push(r.firstResponseRate);
    if (r.conversationsHandled !== undefined) entry.conversations.push(r.conversationsHandled);
    if (r.resolvedCases !== undefined) entry.resolvedCasesList.push(r.resolvedCases);
    weekMap.set(key, entry);
  }

  const trend = [...weekMap.values()]
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((w) => ({
      week: w.weekLabel,
      avgQualityScore: avg(w.qualityScores),
      avgResponseMs: avg(w.responseTimes),
      avgFirstResponseRate: w.firstResponseRates.length
        ? Math.round((w.firstResponseRates.reduce((a, b) => a + b, 0) / w.firstResponseRates.length) * 1000) / 1000
        : null,
      avgConversationsHandled: avg(w.conversations),
      avgResolvedCases: avg(w.resolvedCasesList),
    }));

  res.json(trend);
});

// GET /api/v1/kpi?employeeId=&groupId=&date=&startDate=&endDate=
router.get('/', async (req: Request, res: Response) => {
  const { employeeId, groupId, date, startDate, endDate } = req.query as {
    employeeId?: string;
    groupId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  };

  const filter: Record<string, unknown> = {};
  if (employeeId) filter.employeeId = employeeId;
  if (groupId) filter.customerGroupId = groupId;

  if (date) {
    const d = new Date(`${date}T00:00:00+07:00`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    filter.date = { $gte: d, $lt: next };
  } else if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.$gte = new Date(`${startDate}T00:00:00+07:00`);
    if (endDate) range.$lte = new Date(`${endDate}T23:59:59+07:00`);
    filter.date = range;
  }

  const records = await KpiRecord.find(filter)
    .populate('employeeId', 'name employeeCode department')
    .populate('customerGroupId', 'name')
    .sort({ date: -1 })
    .lean();

  res.json(records);
});

// --- Helpers ---

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export { router as kpiRoutes };
