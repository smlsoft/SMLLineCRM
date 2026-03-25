import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Employee } from '../models/Employee';
import { CustomerGroup } from '../models/CustomerGroup';
import { DailyReport, IEmployeeBreakdown, IIssueCategorySummary } from '../models/DailyReport';
import { IssueCategoryMaster } from '../models/IssueCategoryMaster';
import { Message } from '../models/Message';
import { aiRouter } from '../services/ai';
import { MasterCategoryHint } from '../services/ai/AiAdapter';
import { ConversationInput } from './prompts/dailyAnalysis';

// ---- Static run state (in-memory, for progress tracking) ----
export interface DailyAnalysisRunState {
  date: string;
  status: 'idle' | 'running' | 'complete' | 'failed';
  totalGroups: number;
  processedGroups: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

let runState: DailyAnalysisRunState = {
  date: '',
  status: 'idle',
  totalGroups: 0,
  processedGroups: 0,
};

export function getRunState(): DailyAnalysisRunState {
  return { ...runState };
}

export class DailyAnalysisJob {
  /**
   * Main entry point. Analyzes all conversations for a given date.
   * @param targetDate  date string YYYY-MM-DD (defaults to yesterday)
   * @param force       re-process even if DailyReport already exists
   */
  async runForDate(targetDate?: string, force = false): Promise<void> {
    if (runState.status === 'running') {
      console.log('[DailyAnalysisJob] Already running — skipping');
      return;
    }

    const date = targetDate ?? this.yesterday();
    const dateStart = new Date(`${date}T00:00:00.000Z`);
    const dateEnd   = new Date(`${date}T23:59:59.999Z`);

    runState = {
      date,
      status: 'running',
      totalGroups: 0,
      processedGroups: 0,
      startedAt: new Date().toISOString(),
    };

    try {
      // Upsert DailyReport as pending
      await DailyReport.findOneAndUpdate(
        { date: dateStart },
        {
          $set: {
            date: dateStart,
            status: 'pending',
            processedGroups: 0,
          },
        },
        { upsert: true, new: true }
      );

      // Pre-filter: only groups that have conversations on this date
      const groupIds: Types.ObjectId[] = await Conversation.distinct('customerGroupId', {
        date: { $gte: dateStart, $lte: dateEnd },
      });

      if (groupIds.length === 0) {
        console.log(`[DailyAnalysisJob] No conversations found for ${date}`);
        await DailyReport.findOneAndUpdate(
          { date: dateStart },
          { $set: { status: 'complete', groupCount: 0, jobCount: 0, generatedAt: new Date() } }
        );
        runState = { ...runState, status: 'complete', completedAt: new Date().toISOString() };
        return;
      }

      runState.totalGroups = groupIds.length;
      await DailyReport.findOneAndUpdate(
        { date: dateStart },
        { $set: { totalGroups: groupIds.length } }
      );

      // Load category hints (active only)
      const masterDocs = await IssueCategoryMaster.find({ isActive: true }).lean();
      const masterCategories: MasterCategoryHint[] = masterDocs.map((m) => ({
        name: m.name,
        description: m.description,
        keywords: m.keywords,
      }));

      // Accumulators for DailyReport summary
      let totalJobCount = 0;
      let totalMessages = 0;
      let totalCustomerMessages = 0;
      let totalEmployeeMessages = 0;
      const employeeMessageMap = new Map<string, { name: string; count: number }>();
      const categoryCountMap = new Map<string, number>();

      for (const groupId of groupIds) {
        try {
          await this.processGroup({
            groupId,
            date,
            dateStart,
            dateEnd,
            masterCategories,
            force,
            employeeMessageMap,
            categoryCountMap,
            onCounts: (jobs, msgs, custMsgs, empMsgs) => {
              totalJobCount += jobs;
              totalMessages += msgs;
              totalCustomerMessages += custMsgs;
              totalEmployeeMessages += empMsgs;
            },
          });
        } catch (err) {
          console.error(`[DailyAnalysisJob] Error processing group ${groupId}:`, err);
        }

        runState.processedGroups++;
        await DailyReport.findOneAndUpdate(
          { date: dateStart },
          { $set: { processedGroups: runState.processedGroups } }
        );
      }

      // Build final summary arrays
      const employeeBreakdown: IEmployeeBreakdown[] = [];
      for (const [empIdStr, { name, count }] of employeeMessageMap) {
        employeeBreakdown.push({
          employeeId: new Types.ObjectId(empIdStr),
          employeeName: name,
          messageCount: count,
        });
      }
      employeeBreakdown.sort((a, b) => b.messageCount - a.messageCount);

      const issueCategorySummary: IIssueCategorySummary[] = [];
      for (const [category, count] of categoryCountMap) {
        issueCategorySummary.push({ category, count });
      }
      issueCategorySummary.sort((a, b) => b.count - a.count);

      await DailyReport.findOneAndUpdate(
        { date: dateStart },
        {
          $set: {
            status: 'complete',
            groupCount: groupIds.length,
            jobCount: totalJobCount,
            totalMessages,
            customerMessages: totalCustomerMessages,
            employeeMessages: totalEmployeeMessages,
            employeeBreakdown,
            issueCategorySummary,
            processedGroups: groupIds.length,
            generatedAt: new Date(),
          },
        }
      );

      runState = {
        ...runState,
        status: 'complete',
        totalGroups: groupIds.length,
        processedGroups: groupIds.length,
        completedAt: new Date().toISOString(),
      };
      console.log(`[DailyAnalysisJob] Completed for ${date}: ${totalJobCount} conversations across ${groupIds.length} groups`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[DailyAnalysisJob] Fatal error:', err);
      runState = { ...runState, status: 'failed', completedAt: new Date().toISOString(), error: msg };
      const dateStart2 = new Date(`${date}T00:00:00.000Z`);
      await DailyReport.findOneAndUpdate(
        { date: dateStart2 },
        { $set: { status: 'failed' } }
      ).catch(() => {});
    }
  }

  /** Alias: runs for yesterday (used by cron) */
  async run(): Promise<void> {
    return this.runForDate(this.yesterday());
  }

  private yesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private async processGroup(opts: {
    groupId: Types.ObjectId;
    date: string;
    dateStart: Date;
    dateEnd: Date;
    masterCategories: MasterCategoryHint[];
    force: boolean;
    employeeMessageMap: Map<string, { name: string; count: number }>;
    categoryCountMap: Map<string, number>;
    onCounts: (jobs: number, msgs: number, custMsgs: number, empMsgs: number) => void;
  }): Promise<void> {
    const { groupId, date, dateStart, dateEnd, masterCategories, employeeMessageMap, categoryCountMap, onCounts } = opts;

    // Load group name
    const group = await CustomerGroup.findById(groupId).lean();
    const groupName = group?.name ?? String(groupId);

    // Load conversations for this group on this date
    const conversations = await Conversation.find({
      customerGroupId: groupId,
      date: { $gte: dateStart, $lte: dateEnd },
    })
      .populate<{ participantEmployeeIds: { _id: Types.ObjectId; name: string }[] }>(
        'participantEmployeeIds',
        'name'
      )
      .lean();

    if (conversations.length === 0) return;

    // Load all employees for name lookup
    const allEmpIds = new Set<string>();
    for (const conv of conversations) {
      for (const emp of conv.participantEmployeeIds as unknown as { _id: Types.ObjectId; name: string }[]) {
        allEmpIds.add(emp._id.toString());
      }
    }
    const employees = allEmpIds.size > 0
      ? await Employee.find({ _id: { $in: [...allEmpIds] } }, 'name').lean()
      : [];
    const empNameMap = new Map(employees.map((e) => [e._id.toString(), e.name]));

    // Accumulate employee message counts
    for (const conv of conversations) {
      // conv.participantEmployeeIds after populate is an array of objects
      const empIds = conv.participantEmployeeIds as unknown as Array<{ _id: Types.ObjectId; name: string } | Types.ObjectId>;
      for (const empRef of empIds) {
        const empId = typeof empRef === 'object' && '_id' in empRef
          ? empRef._id.toString()
          : String(empRef);
        const empName = (typeof empRef === 'object' && 'name' in empRef && empRef.name)
          ? empRef.name
          : empNameMap.get(empId) ?? empId;
        const existing = employeeMessageMap.get(empId);
        if (existing) {
          existing.count += conv.employeeMessageCount ?? 0;
        } else {
          employeeMessageMap.set(empId, { name: empName, count: conv.employeeMessageCount ?? 0 });
        }
      }
    }

    // Build conversation inputs for AI (fetch real messages from DB + save to transcript)
    const convInputs: ConversationInput[] = await Promise.all(
      conversations.map(async (conv) => {
        const startTime = new Date(conv.startedAt).toLocaleTimeString('th-TH', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
        });
        const endTime = new Date(conv.lastMessageAt).toLocaleTimeString('th-TH', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
        });

        // Use saved transcript if already populated, otherwise fetch from Message collection
        type TranscriptEntry = { senderDisplayName: string; senderType: string; textContent?: string; messageType: string; timestamp: Date };
        let transcriptLines: TranscriptEntry[];
        if (conv.transcript && conv.transcript.length > 0) {
          transcriptLines = conv.transcript as TranscriptEntry[];
        } else {
          const msgs = await Message.find({ conversationId: conv._id })
            .sort({ timestamp: 1 })
            .lean();
          transcriptLines = msgs.map((m) => ({
            senderDisplayName: m.senderDisplayName,
            senderType: m.senderType,
            textContent: m.textContent,
            messageType: m.messageType,
            timestamp: m.timestamp,
          }));
          // Save transcript into Conversation so it survives future Message collection cleanup
          if (transcriptLines.length > 0) {
            await Conversation.updateOne(
              { _id: conv._id },
              { $set: { transcript: transcriptLines } }
            );
          }
        }

        const lines = transcriptLines
          .map((t) => `[${t.senderDisplayName}] ${t.textContent ?? `(${t.messageType})`}`)
          .join('\n');
        return {
          conversationId: conv._id.toString(),
          startedAt: startTime,
          endedAt: endTime,
          messages: lines || '(ไม่มีข้อความ)',
        };
      })
    );

    // Call AI — batch analysis for this group
    let aiResults: import('./prompts/dailyAnalysis').ConversationCategoryResult[] = [];
    try {
      const { result } = await aiRouter.callWithFailover(
        'issueAnalysis',
        async (adapter) => adapter.analyzeDailyConversations({
          groupName,
          date,
          conversations: convInputs,
          masterCategories,
        })
      );
      aiResults = result;
    } catch (err) {
      console.error(`[DailyAnalysisJob] AI error for group ${groupName}:`, err);
      // Continue without category data
    }

    // Map results by conversationId
    const resultMap = new Map(aiResults.map((r) => [r.conversationId, r]));

    // Update each conversation
    for (const conv of conversations) {
      const aiRes = resultMap.get(conv._id.toString());
      if (aiRes) {
        const cat = aiRes.category || 'ปัญหาทั่วไป';
        await Conversation.updateOne(
          { _id: conv._id },
          { $set: { issueCategory: cat, issueSummary: aiRes.summary } }
        );
        categoryCountMap.set(cat, (categoryCountMap.get(cat) ?? 0) + 1);
      } else {
        // No category from AI — mark as general
        await Conversation.updateOne(
          { _id: conv._id },
          { $set: { issueCategory: 'ปัญหาทั่วไป' } }
        );
        categoryCountMap.set('ปัญหาทั่วไป', (categoryCountMap.get('ปัญหาทั่วไป') ?? 0) + 1);
      }
    }

    // Report counts back
    const totalConvMsgs = conversations.reduce((s, c) => s + (c.messageCount ?? 0), 0);
    const totalCustMsgs = conversations.reduce((s, c) => s + (c.customerMessageCount ?? 0), 0);
    const totalEmpMsgs = conversations.reduce((s, c) => s + (c.employeeMessageCount ?? 0), 0);
    onCounts(conversations.length, totalConvMsgs, totalCustMsgs, totalEmpMsgs);

    console.log(`[DailyAnalysisJob] Group "${groupName}": ${conversations.length} conversations processed`);
  }
}
