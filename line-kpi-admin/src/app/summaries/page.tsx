'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { dailyReportApi, messagesApi } from '@/lib/api';
import { formatMs, formatTime, todayISO } from '@/lib/utils';
import type {
  DailyReport,
  DailyReportFilterOptions,
  DailyAnalysisRunState,
  Conversation,
  Message,
} from '@/types/api';
import {
  RefreshCw, Play, ChevronDown, ChevronUp, MessageSquare,
  Users, FileText, Tag, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Main Page (wrapped in Suspense for useSearchParams)
// ============================================================
export default function SummariesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-on-surface-variant text-sm">กำลังโหลด...</div>}>
      <SummariesContent />
    </Suspense>
  );
}

function SummariesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams.get('date') ?? todayISO();
  const groupParam = searchParams.get('groupId') ?? '';
  const categoryParam = searchParams.get('category') ?? '';
  const employeeParam = searchParams.get('employeeId') ?? '';
  const sortParam = searchParams.get('sort') ?? 'startedAt';

  const [date, setDate] = useState(dateParam);
  const [groupId, setGroupId] = useState(groupParam);
  const [category, setCategory] = useState(categoryParam);
  const [employeeId, setEmployeeId] = useState(employeeParam);
  const [sort, setSort] = useState(sortParam);

  const [report, setReport] = useState<DailyReport | null>(null);
  const [filterOptions, setFilterOptions] = useState<DailyReportFilterOptions | null>(null);
  const [jobs, setJobs] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [runState, setRunState] = useState<DailyAnalysisRunState | null>(null);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync URL params → state whenever they change (e.g. browser back)
  useEffect(() => {
    setDate(searchParams.get('date') ?? todayISO());
    setGroupId(searchParams.get('groupId') ?? '');
    setCategory(searchParams.get('category') ?? '');
    setEmployeeId(searchParams.get('employeeId') ?? '');
    setSort(searchParams.get('sort') ?? 'startedAt');
  }, [searchParams]);

  // Push filter changes to URL
  const pushParams = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { date, groupId, category, employeeId, sort, ...overrides };
    if (merged.date) params.set('date', merged.date);
    if (merged.groupId) params.set('groupId', merged.groupId);
    if (merged.category) params.set('category', merged.category);
    if (merged.employeeId) params.set('employeeId', merged.employeeId);
    if (merged.sort && merged.sort !== 'startedAt') params.set('sort', merged.sort);
    router.push(`/summaries?${params.toString()}`, { scroll: false });
  }, [date, groupId, category, employeeId, sort, router]);

  const loadData = useCallback(async (targetDate: string, opts?: {
    groupId?: string; category?: string; employeeId?: string; sort?: string; page?: number;
  }) => {
    setLoading(true);
    try {
      const [reportRes, filterRes, jobsRes] = await Promise.all([
        dailyReportApi.getSummary(targetDate),
        dailyReportApi.getFilterOptions(targetDate),
        dailyReportApi.getJobs({
          date: targetDate,
          groupId: opts?.groupId ?? groupId,
          category: opts?.category ?? category,
          employeeId: opts?.employeeId ?? employeeId,
          sort: opts?.sort ?? sort,
          page: opts?.page ?? page,
          limit: 50,
        }),
      ]);
      setReport(reportRes);
      setFilterOptions(filterRes);
      setJobs(jobsRes.data);
      setTotal(jobsRes.total);
      setTotalPages(jobsRes.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, category, employeeId, sort, page]);

  // Initial load + reload when date/filters change
  useEffect(() => {
    loadData(date, { groupId, category, employeeId, sort, page: 1 });
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, groupId, category, employeeId, sort]);

  // Poll job status while running
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const state = await dailyReportApi.getJobStatus().catch(() => null);
      if (state) {
        setRunState(state);
        if (state.status !== 'running') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          loadData(date, { groupId, category, employeeId, sort, page: 1 });
        }
      }
    }, 30000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, groupId, category, employeeId, sort]);

  useEffect(() => {
    dailyReportApi.getJobStatus().then((s) => {
      setRunState(s);
      if (s.status === 'running') startPolling();
    }).catch(() => {});

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await dailyReportApi.trigger({ date, force: true });
      startPolling();
    } catch {
      // ignore
    } finally {
      setTriggering(false);
    }
  };

  const handleRefresh = () => {
    loadData(date, { groupId, category, employeeId, sort, page });
  };

  const isRunning = runState?.status === 'running';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-on-surface">สรุปรายวัน</h1>
          <p className="text-xs text-on-surface-variant mt-1">บทสนทนาและการวิเคราะห์ปัญหา</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              pushParams({ date: e.target.value });
            }}
            className="bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-3 py-2 rounded-xl text-sm font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            รีเฟรช
          </button>
          <button
            onClick={handleTrigger}
            disabled={isRunning || triggering}
            className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning || triggering
              ? <Loader2 className="size-4 animate-spin" />
              : <Play className="size-4" />}
            ประมวลผลใหม่
          </button>
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && runState && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-primary">กำลังประมวลผล...</span>
            <span className="text-on-surface-variant">
              {runState.processedGroups} / {runState.totalGroups} กลุ่ม
            </span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-primary rounded-full transition-all duration-500"
              style={{ width: runState.totalGroups > 0
                ? `${(runState.processedGroups / runState.totalGroups) * 100}%`
                : '5%' }}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {report && report.status === 'complete' ? (
        <SummarySection report={report} />
      ) : report?.status === 'pending' ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-400">
          กำลังรอประมวลผล — กด &quot;ประมวลผลใหม่&quot; เพื่อเริ่มต้น
        </div>
      ) : !report ? (
        <div className="bg-surface-container rounded-2xl p-4 text-sm text-on-surface-variant">
          ยังไม่มีข้อมูลสรุปสำหรับวันที่ {date}
        </div>
      ) : null}

      {/* Filter Bar */}
      {filterOptions && (
        <FilterBar
          filterOptions={filterOptions}
          groupId={groupId}
          category={category}
          employeeId={employeeId}
          sort={sort}
          onGroupChange={(v) => { setGroupId(v); pushParams({ groupId: v }); }}
          onCategoryChange={(v) => { setCategory(v); pushParams({ category: v }); }}
          onEmployeeChange={(v) => { setEmployeeId(v); pushParams({ employeeId: v }); }}
          onSortChange={(v) => { setSort(v); pushParams({ sort: v }); }}
        />
      )}

      {/* Jobs Table */}
      <JobsTable
        jobs={jobs}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => { setPage(p); loadData(date, { groupId, category, employeeId, sort, page: p }); }}
      />
    </div>
  );
}

// ============================================================
// Summary Section
// ============================================================
function SummarySection({ report }: { report: DailyReport }) {
  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="กลุ่มที่ติดต่อ" value={report.groupCount} />
        <SummaryCard icon={FileText} label="Job/Case ทั้งหมด" value={report.jobCount} />
        <SummaryCard icon={MessageSquare} label="ข้อความทั้งหมด" value={report.totalMessages} />
        <SummaryCard icon={Tag} label="ประเภทปัญหา" value={report.issueCategorySummary.length} />
      </div>

      {/* Message breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">ข้อความแยกตามประเภท</p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xl font-extrabold text-on-surface">{report.customerMessages}</p>
              <p className="text-xs text-on-surface-variant">ลูกค้า</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-surface">{report.employeeMessages}</p>
              <p className="text-xs text-on-surface-variant">พนักงาน</p>
            </div>
          </div>
          {report.employeeBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {report.employeeBreakdown.slice(0, 8).map((e) => (
                <span key={e.employeeId} className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded-lg text-on-surface-variant">
                  {e.employeeName}: <span className="font-bold text-on-surface">{e.messageCount}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">ประเภทปัญหา</p>
          <div className="flex flex-wrap gap-1.5">
            {report.issueCategorySummary.length === 0 ? (
              <p className="text-xs text-on-surface-variant">ยังไม่มีข้อมูล</p>
            ) : (
              report.issueCategorySummary.map((c) => (
                <span
                  key={c.category}
                  className="px-2.5 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold"
                >
                  {c.category} <span className="opacity-60">{c.count}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value,
}: {
  icon: React.ElementType; label: string; value: number;
}) {
  return (
    <div className="bg-surface-container rounded-2xl p-4 text-center space-y-1">
      <div className="flex items-center justify-center">
        <Icon className="size-5 text-primary/60" />
      </div>
      <p className="text-2xl font-extrabold text-on-surface">{value}</p>
      <p className="text-[10px] text-on-surface-variant">{label}</p>
    </div>
  );
}

// ============================================================
// Filter Bar
// ============================================================
function FilterBar({
  filterOptions, groupId, category, employeeId, sort,
  onGroupChange, onCategoryChange, onEmployeeChange, onSortChange,
}: {
  filterOptions: DailyReportFilterOptions;
  groupId: string; category: string; employeeId: string; sort: string;
  onGroupChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onEmployeeChange: (v: string) => void;
  onSortChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={groupId}
        onChange={(e) => onGroupChange(e.target.value)}
        className="bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">— ทุกกลุ่ม —</option>
        {filterOptions.groups.map((g) => (
          <option key={g._id} value={g._id}>{g.name}</option>
        ))}
      </select>

      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">— ทุกประเภทปัญหา —</option>
        {filterOptions.categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={employeeId}
        onChange={(e) => onEmployeeChange(e.target.value)}
        className="bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">— ทุกพนักงาน —</option>
        {filterOptions.employees.map((e) => (
          <option key={e._id} value={e._id}>{e.name}</option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="startedAt">เรียงตามเวลาเปิด</option>
        <option value="groupName">เรียงตามชื่อกลุ่ม</option>
      </select>
    </div>
  );
}

// ============================================================
// Jobs Table
// ============================================================
function JobsTable({
  jobs, loading, total, page, totalPages, onPageChange,
}: {
  jobs: Conversation[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-surface-container rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-8 text-center text-sm text-on-surface-variant border border-surface-container-high/30">
        ไม่พบบทสนทนาตามเงื่อนไขที่เลือก
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">พบ {total} รายการ</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded-lg border border-surface-container-high disabled:opacity-40"
            >
              ←
            </button>
            <span>{page} / {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded-lg border border-surface-container-high disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
        <div className="divide-y divide-surface-container-low/50">
          {jobs.map((job) => (
            <JobRow
              key={job._id}
              job={job}
              expanded={expandedId === job._id}
              onToggle={() => setExpandedId((prev) => prev === job._id ? null : job._id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Job Row (single conversation)
// ============================================================
function JobRow({ job, expanded, onToggle }: {
  job: Conversation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const groupName = typeof job.customerGroupId === 'object' ? job.customerGroupId.name : job.customerGroupId;
  const employees = job.participantEmployeeIds ?? [];
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Lazy load messages when expanded (transcript is not stored in real-time)
  useEffect(() => {
    if (!expanded) return;
    if (job.transcript && job.transcript.length > 0) return;
    if (messages.length > 0) return; // already loaded
    setLoadingMsgs(true);
    messagesApi.list(job._id)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [expanded, job._id, job.transcript, messages.length]);

  // Unified display entries: prefer transcript, fallback to fetched messages
  type ChatEntry = { senderDisplayName: string; senderType: string; textContent?: string; messageType: string };
  const chatEntries: ChatEntry[] = job.transcript && job.transcript.length > 0
    ? job.transcript
    : messages;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-3.5 hover:bg-surface-container-low/30 transition-colors text-left"
      >
        {/* Category badge */}
        <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary">
          {job.issueCategory ?? 'ปัญหาทั่วไป'}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-on-surface">{groupName}</span>
            <span className="text-xs text-on-surface-variant">
              {formatTime(job.startedAt)} – {formatTime(job.lastMessageAt)}
            </span>
          </div>
          {job.issueSummary && (
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">{job.issueSummary}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {job.avgResponseMs != null && (
              <span className="text-[10px] text-on-surface-variant">
                ตอบเฉลี่ย {formatMs(job.avgResponseMs)}
              </span>
            )}
            {employees.length > 0 && (
              <span className="text-[10px] text-on-surface-variant">
                พนักงาน: {employees.map((e) => e.name).join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-on-surface-variant">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-surface-container-low/20">
          {loadingMsgs ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-on-surface-variant">
              <Loader2 className="size-3.5 animate-spin" />
              กำลังโหลดข้อความ...
            </div>
          ) : chatEntries.length === 0 ? (
            <p className="text-xs text-center text-on-surface-variant py-4">ไม่มีข้อความ</p>
          ) : (
            <div className="bg-surface-container rounded-2xl p-4 max-h-72 overflow-y-auto space-y-2">
              {chatEntries.map((t, i) => (
                <div key={i} className={cn('flex gap-2', t.senderType === 'employee' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] px-3 py-2 rounded-2xl text-xs',
                    t.senderType === 'employee'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-on-surface'
                  )}>
                    <p className="font-bold text-[10px] mb-0.5 opacity-70">{t.senderDisplayName}</p>
                    <p>{t.textContent ?? `(${t.messageType})`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
