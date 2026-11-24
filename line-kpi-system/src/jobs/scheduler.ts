import cron from 'node-cron';
import { config } from '../config';
import { configService } from '../services/ConfigService';
import { DailyAnalysisJob } from './DailyAnalysisJob';
import { MediaCleanupJob } from './MediaCleanupJob';

const dailyAnalysisJob = new DailyAnalysisJob();
const mediaCleanupJob = new MediaCleanupJob();

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

  // 3 AM — Delete old LINE media files based on media.retentionDays
  cron.schedule(config.cron.mediaCleanup, async () => {
    try {
      await mediaCleanupJob.run();
    } catch (err) {
      console.error('[Scheduler] MediaCleanupJob error:', err);
    }
  }, { timezone: process.env['TZ'] ?? 'Asia/Bangkok' });

  console.log('[Scheduler] Cron jobs scheduled');
  console.log(`  Daily analysis: ${config.cron.dailyAnalysis}`);
  console.log(`  Media cleanup:  ${config.cron.mediaCleanup}`);
}
