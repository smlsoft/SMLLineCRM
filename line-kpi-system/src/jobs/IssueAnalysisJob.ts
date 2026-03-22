import { Types } from 'mongoose';
import { CustomerGroup, ICustomerGroup } from '../models/CustomerGroup';
import { Message, IMessage } from '../models/Message';
import { IssueReport } from '../models/IssueReport';
import { createAiAdapter } from '../services/ai';
import { config } from '../config';

type LeanMessage = IMessage & { _id: Types.ObjectId };

const MAX_CHARS_PER_PROMPT = 60000;

export class IssueAnalysisJob {
  async run(): Promise<void> {
    const targetDate = config.evaluatePreviousDay ? yesterday() : today();
    await this.runForDate(targetDate);
  }

  async runForDate(targetDate: Date): Promise<void> {
    const dateStr = formatDate(targetDate);
    console.log(`[IssueAnalysisJob] Running for ${dateStr}`);

    const ai = await createAiAdapter();
    const groups = await CustomerGroup.find({ isActive: true }).lean<ICustomerGroup[]>();

    for (const group of groups) {
      try {
        await this.analyzeGroup(ai, group._id as Types.ObjectId, group.name, targetDate, dateStr);
      } catch (err) {
        console.error(`[IssueAnalysisJob] Group ${group.name} failed:`, err);
      }
    }

    console.log(`[IssueAnalysisJob] Done for ${dateStr}`);
  }

  private async analyzeGroup(
    ai: import('../services/ai').AiAdapter,
    customerGroupId: Types.ObjectId,
    groupName: string,
    targetDate: Date,
    dateStr: string
  ): Promise<void> {
    // Idempotency check
    const existing = await IssueReport.findOne({ customerGroupId, date: dayFloor(targetDate) });
    if (existing?.status === 'complete') {
      console.log(`[IssueAnalysisJob] Skipping group ${groupName} — already complete`);
      return;
    }

    const { start, end } = dayRange(targetDate);

    // Get today's messages (customer messages only for issue analysis)
    const messages = await Message.find({
      customerGroupId,
      timestamp: { $gte: start, $lt: end },
    })
      .sort({ timestamp: 1 })
      .lean<LeanMessage[]>();

    const customerMessages = messages.filter((m) => m.senderType === 'customer');
    if (customerMessages.length === 0) {
      console.log(`[IssueAnalysisJob] No customer messages for group ${groupName} on ${dateStr}`);
      return;
    }

    // Get previous 7 days issue categories for recurring/emerging detection
    const sevenDaysAgo = new Date(dayFloor(targetDate));
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const previousReports = await IssueReport.find({
      customerGroupId,
      date: { $gte: sevenDaysAgo, $lt: dayFloor(targetDate) },
      status: 'complete',
    })
      .sort({ date: -1 })
      .lean();

    const previousCategories = [
      ...new Set(previousReports.flatMap((r) => r.issueCategories.map((c) => c.category))),
    ];

    // Build transcript (all messages for context, not just customer)
    const transcript = buildTranscript(messages);
    const truncated = transcript.length > MAX_CHARS_PER_PROMPT
      ? transcript.slice(0, MAX_CHARS_PER_PROMPT)
      : transcript;

    // Upsert with pending status
    const reportDoc = await IssueReport.findOneAndUpdate(
      { customerGroupId, date: dayFloor(targetDate) },
      { $set: { status: 'pending' } },
      { upsert: true, new: true }
    );

    try {
      const result = await ai.analyzeIssues({
        groupName,
        date: dateStr,
        messageLog: truncated,
        previousCategories,
      });

      await IssueReport.updateOne(
        { _id: reportDoc._id },
        {
          $set: {
            issueCategories: result.issueCategories,
            recurringIssues: result.recurringIssues,
            emergingIssues: result.emergingIssues,
            rootCauseInsight: result.rootCauseInsight,
            recommendedActions: result.recommendedActions,
            aiProvider: config.aiProvider,
            aiModel: config.openrouter.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            generatedAt: new Date(),
            status: 'complete',
          },
        }
      );

      console.log(`[IssueAnalysisJob] Done for group ${groupName}`);
    } catch (err) {
      await IssueReport.updateOne(
        { _id: reportDoc._id },
        { $set: { status: 'failed', errorMessage: String(err) } }
      );
      console.error(`[IssueAnalysisJob] AI failed for group ${groupName}:`, err);
    }
  }
}

// --- Helpers ---

function today(): Date {
  return new Date();
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function dayFloor(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayRange(date: Date): { start: Date; end: Date } {
  const start = dayFloor(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function buildTranscript(messages: LeanMessage[]): string {
  return messages
    .filter((m) => m.messageType === 'text' && m.textContent)
    .map(
      (m) =>
        `[${formatTime(m.timestamp)}] [${m.senderType === 'employee' ? 'พนักงาน' : 'ลูกค้า'}]: ${m.textContent}`
    )
    .join('\n');
}
