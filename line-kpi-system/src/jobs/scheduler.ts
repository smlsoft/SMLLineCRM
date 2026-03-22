import cron from 'node-cron';
import { config } from '../config';
import { configService } from '../services/ConfigService';
import { DailyEvaluationJob } from './DailyEvaluationJob';
import { IssueAnalysisJob } from './IssueAnalysisJob';

const evaluationJob = new DailyEvaluationJob();
const issueJob = new IssueAnalysisJob();

export function startScheduler(): void {
  // 11 PM — AI evaluation (KPI + daily summary)
  cron.schedule(config.cron.dailyEvaluation, async () => {
    const cfg = await configService.getConfig();
    if (!cfg.jobs.dailyEvaluation.enabled) {
      console.log('[Scheduler] DailyEvaluationJob disabled — skipping');
      return;
    }
    try {
      await evaluationJob.run();
    } catch (err) {
      console.error('[Scheduler] DailyEvaluationJob error:', err);
    }
  }, { timezone: process.env['TZ'] ?? 'Asia/Bangkok' });

  // 11:30 PM — customer issue analysis
  cron.schedule(config.cron.issueAnalysis, async () => {
    const cfg = await configService.getConfig();
    if (!cfg.jobs.issueAnalysis.enabled) {
      console.log('[Scheduler] IssueAnalysisJob disabled — skipping');
      return;
    }
    try {
      await issueJob.run();
    } catch (err) {
      console.error('[Scheduler] IssueAnalysisJob error:', err);
    }
  }, { timezone: process.env['TZ'] ?? 'Asia/Bangkok' });

  console.log('[Scheduler] Cron jobs scheduled');
  console.log(`  Daily evaluation: ${config.cron.dailyEvaluation}`);
  console.log(`  Issue analysis:   ${config.cron.issueAnalysis}`);
}
