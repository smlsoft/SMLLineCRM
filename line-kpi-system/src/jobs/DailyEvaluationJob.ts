import { Types } from 'mongoose';
import { CustomerGroup, ICustomerGroup } from '../models/CustomerGroup';
import { Conversation, IConversation } from '../models/Conversation';
import { Message, IMessage } from '../models/Message';
import { Employee } from '../models/Employee';
import { DailySummary } from '../models/DailySummary';
import { KpiRecord } from '../models/KpiRecord';
import { createAiAdapter, AiAdapter } from '../services/ai';
import { GroupSummaryResult } from '../services/ai/AiAdapter';
import { buildGroupSummaryFromThreadsPrompt } from './prompts/groupSummary';
import { config } from '../config';

// Lean (plain-object) versions of Mongoose documents
type LeanConversation = IConversation & { _id: Types.ObjectId };
type LeanMessage = IMessage & { _id: Types.ObjectId };

// Estimate ~0.4 tokens per character; stay under 24K tokens per prompt
const MAX_CHARS_PER_PROMPT = 60000;

export class DailyEvaluationJob {
  async run(): Promise<void> {
    const targetDate = config.evaluatePreviousDay ? yesterday() : today();
    await this.runForDate(targetDate);
  }

  async runForDate(targetDate: Date): Promise<void> {
    const dateStr = formatDate(targetDate);
    console.log(`[DailyEvaluationJob] Running for ${dateStr}`);

    const ai = await createAiAdapter();
    const groups = await CustomerGroup.find({ isActive: true }).lean<ICustomerGroup[]>();

    for (const group of groups) {
      try {
        await this.evaluateGroup(ai, group._id as Types.ObjectId, group.name, targetDate, dateStr);
      } catch (err) {
        console.error(`[DailyEvaluationJob] Group ${group.name} failed:`, err);
      }
    }

    console.log(`[DailyEvaluationJob] Done for ${dateStr}`);
  }

  private async evaluateGroup(
    ai: AiAdapter,
    customerGroupId: Types.ObjectId,
    groupName: string,
    targetDate: Date,
    dateStr: string
  ): Promise<void> {
    // Idempotency check
    const existing = await DailySummary.findOne({ customerGroupId, date: dayFloor(targetDate) });
    if (existing?.status === 'complete') {
      console.log(`[DailyEvaluationJob] Skipping group ${groupName} — already complete`);
      return;
    }

    const { start, end } = dayRange(targetDate);
    const conversations = await Conversation.find({
      customerGroupId,
      date: { $gte: dayFloor(targetDate), $lt: dayFloor(end) },
    }).lean<LeanConversation[]>();

    if (conversations.length === 0) {
      console.log(`[DailyEvaluationJob] No conversations for group ${groupName} on ${dateStr}`);
      return;
    }

    const messages = await Message.find({
      customerGroupId,
      timestamp: { $gte: start, $lt: end },
    })
      .sort({ timestamp: 1 })
      .lean<LeanMessage[]>();

    // Raw metrics (no AI)
    const totalMessages = messages.length;
    const firstResponseTimes = conversations
      .map((c) => c.firstResponseMs)
      .filter((v): v is number => v !== undefined);
    const responseTimes = conversations
      .map((c) => c.avgResponseMs)
      .filter((v): v is number => v !== undefined);
    const avgFirstResponseMs = avg(firstResponseTimes);
    const avgResponseMs = avg(responseTimes);

    // Upsert summary with raw metrics (status: pending)
    const summaryDoc = await DailySummary.findOneAndUpdate(
      { customerGroupId, date: dayFloor(targetDate) },
      {
        $set: {
          totalConversations: conversations.length,
          totalMessages,
          avgFirstResponseMs,
          avgResponseMs,
          status: 'pending',
        },
      },
      { upsert: true, new: true }
    );

    // Build message log transcript
    const transcript = buildTranscript(messages);

    // AI group summary (with map-reduce if too long)
    try {
      let summaryResult;
      if (transcript.length <= MAX_CHARS_PER_PROMPT) {
        summaryResult = await ai.generateGroupSummary({
          groupName,
          date: dateStr,
          messageLog: transcript,
          rawMetrics: { totalConversations: conversations.length, totalMessages, avgFirstResponseMs, avgResponseMs },
        });
      } else {
        summaryResult = await this.summarizeByThreads(ai, groupName, dateStr, conversations, messages);
      }

      await DailySummary.updateOne(
        { _id: summaryDoc._id },
        {
          $set: {
            summaryText: summaryResult.summaryText,
            topIssues: summaryResult.topIssues,
            sentimentScore: summaryResult.sentimentScore,
            aiProvider: config.aiProvider,
            aiModel: config.openrouter.model,
            promptTokens: summaryResult.promptTokens,
            completionTokens: summaryResult.completionTokens,
            generatedAt: new Date(),
            status: 'complete',
          },
        }
      );
    } catch (err) {
      await DailySummary.updateOne(
        { _id: summaryDoc._id },
        { $set: { status: 'failed', errorMessage: String(err) } }
      );
      console.error(`[DailyEvaluationJob] Group summary AI failed for ${groupName}:`, err);
    }

    // Per-employee KPI
    const employeeIds = [
      ...new Set(conversations.flatMap((c) => c.participantEmployeeIds.map((id) => id.toString()))),
    ];

    for (const employeeIdStr of employeeIds) {
      await this.evaluateEmployee(
        ai,
        new Types.ObjectId(employeeIdStr),
        customerGroupId,
        targetDate,
        dateStr,
        messages
      );
    }

  }

  private async summarizeByThreads(
    ai: AiAdapter,
    groupName: string,
    dateStr: string,
    conversations: LeanConversation[],
    allMessages: LeanMessage[]
  ): Promise<GroupSummaryResult> {
    const threadSummaries: string[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const conv of conversations) {
      const convMsgs = allMessages.filter(
        (m) => m.conversationId.toString() === conv._id.toString()
      );
      const threadTranscript = buildTranscript(convMsgs);
      const result = await ai.generateGroupSummary({
        groupName,
        date: dateStr,
        messageLog: threadTranscript,
        rawMetrics: { totalConversations: 1, totalMessages: convMsgs.length },
      });
      threadSummaries.push(result.summaryText);
      totalPromptTokens += result.promptTokens;
      totalCompletionTokens += result.completionTokens;
    }

    // Second pass: summarize all thread summaries
    const consolidatedPrompt = buildGroupSummaryFromThreadsPrompt(groupName, dateStr, threadSummaries);
    const finalResult = await ai.generateGroupSummary({
      groupName,
      date: dateStr,
      messageLog: consolidatedPrompt,
      rawMetrics: { totalConversations: conversations.length, totalMessages: allMessages.length },
    });

    return {
      ...finalResult,
      promptTokens: totalPromptTokens + finalResult.promptTokens,
      completionTokens: totalCompletionTokens + finalResult.completionTokens,
    };
  }

  private async evaluateEmployee(
    ai: AiAdapter,
    employeeId: Types.ObjectId,
    customerGroupId: Types.ObjectId,
    targetDate: Date,
    dateStr: string,
    allMessages: LeanMessage[]
  ): Promise<void> {
    // Idempotency
    const existing = await KpiRecord.findOne({ employeeId, date: dayFloor(targetDate) });
    if (existing?.status === 'complete') return;

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return;

    const empMessages = allMessages.filter(
      (m) => m.employeeId?.toString() === employeeId.toString()
    );

    if (empMessages.length === 0) return;

    // Raw metrics
    const convIds = [...new Set(empMessages.map((m) => m.conversationId.toString()))];
    const convs = await Conversation.find({ _id: { $in: convIds } }).lean<LeanConversation[]>();

    const responseGaps = empMessages
      .map((m) => m.responseGapMs)
      .filter((v): v is number => v !== undefined);
    const firstResponseMsList = convs
      .map((c) => c.firstResponseMs)
      .filter((v): v is number => v !== undefined);
    const firstUnder5Min = firstResponseMsList.filter((ms) => ms <= 5 * 60 * 1000).length;

    const rawMetrics = {
      conversationsHandled: convIds.length,
      messagesSent: empMessages.length,
      avgResponseMs: avg(responseGaps),
      maxResponseMs: responseGaps.length ? Math.max(...responseGaps) : undefined,
      firstResponseRate: convIds.length > 0 ? firstUnder5Min / convIds.length : undefined,
    };

    // Sample messages for AI (up to 20 text messages)
    const sampleMessages = empMessages
      .filter((m) => m.messageType === 'text' && m.textContent)
      .slice(0, 20)
      .map((m) => `[${formatTime(m.timestamp)}] ${m.textContent}`)
      .join('\n');

    const kpiDoc = await KpiRecord.findOneAndUpdate(
      { employeeId, date: dayFloor(targetDate) },
      {
        $set: {
          customerGroupId,
          conversationsHandled: rawMetrics.conversationsHandled,
          messagesSent: rawMetrics.messagesSent,
          avgResponseMs: rawMetrics.avgResponseMs,
          maxResponseMs: rawMetrics.maxResponseMs,
          firstResponseRate: rawMetrics.firstResponseRate,
          firstResponseUnder5Min: firstUnder5Min,
          status: 'pending',
        },
      },
      { upsert: true, new: true }
    );

    try {
      const result = await ai.evaluateStaffKpi({
        employeeName: employee.name,
        date: dateStr,
        rawMetrics,
        sampleMessages,
      });

      await KpiRecord.updateOne(
        { _id: kpiDoc._id },
        {
          $set: {
            qualityScore: result.qualityScore,
            kpiNarrative: result.kpiNarrative,
            strengths: result.strengths,
            areasToImprove: result.areasToImprove,
            aiProvider: config.aiProvider,
            aiModel: config.openrouter.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            status: 'complete',
          },
        }
      );
    } catch (err) {
      await KpiRecord.updateOne(
        { _id: kpiDoc._id },
        { $set: { status: 'failed', errorMessage: String(err) } }
      );
      console.error(`[DailyEvaluationJob] KPI AI failed for employee ${employee.name}:`, err);
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

function avg(arr: number[]): number | undefined {
  if (!arr.length) return undefined;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
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
