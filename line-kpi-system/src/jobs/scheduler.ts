import cron from 'node-cron';
import { config } from '../config';
import { configService } from '../services/ConfigService';
import { DailyAnalysisJob } from './DailyAnalysisJob';

const dailyAnalysisJob = new DailyAnalysisJob();

export function startScheduler(): void {
  // 11 PM — AI daily analysis (categorize conversations)
  cron.schedule(config.cron.dailyAnalysis, async () => {
    const cfg = await configService.getConfig();
    if (!cfg.jobs.dailyAnalysis.enabled) {
      console.log('[Scheduler] DailyAnalysisJob disabled — skipping');
      return;
    }
    try {
      await dailyAnalysisJob.run();
    } catch (err) {
      console.error('[Scheduler] DailyAnalysisJob error:', err);
    }
  }, { timezone: process.env['TZ'] ?? 'Asia/Bangkok' });

  console.log('[Scheduler] Cron jobs scheduled');
  console.log(`  Daily analysis: ${config.cron.dailyAnalysis}`);
}
