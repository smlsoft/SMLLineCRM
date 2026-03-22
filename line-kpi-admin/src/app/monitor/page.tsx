'use client';

import { useState, useEffect, useCallback } from 'react';
import { monitorApi } from '@/lib/api';
import type { MonitorGroup, MonitorEmployee, MonitorConversation } from '@/types/api';
import { formatMs, formatDateTime, cn } from '@/lib/utils';
import { RefreshCw, Activity, Clock, CheckCircle2, ChevronDown, ChevronUp, Check, X, Minus, Bot } from 'lucide-react';
import { StatCard } from '@/components/StatCard';

const REFRESH_INTERVAL = 30;

const PRIORITY_CONFIG = {
  urgent: {
    borderCls: 'border-l-red-500',
    badgeCls: 'bg-red-500/10 text-red-600 dark:text-red-400',
    label: 'ด่วน',
    dot: '🔴',
  },
  warning: {
    borderCls: 'border-l-amber-400',
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'รอ',
    dot: '🟡',
  },
  normal: {
    borderCls: 'border-l-emerald-500',
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'ปกติ',
    dot: '🟢',
  },
} as const;

const RESPONSE_STATUS_CONFIG = {
  slow: { cls: 'text-red-600 dark:text-red-400', label: 'ช้า' },
  waiting: { cls: 'text-amber-600 dark:text-amber-400', label: 'รอ' },
  normal: { cls: 'text-emerald-600 dark:text-emerald-400', label: 'ปกติ' },
} as const;

export default function MonitorPage() {
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(() => {
    monitorApi
      .get()
      .then(setGroups)
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLastRefreshed(new Date());
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          loadData();
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loadData]);

  const handleManualRefresh = () => {
    setCountdown(REFRESH_INTERVAL);
    loadData();
  };

  const handleResolve = useCallback(
    async (conversationId: string, resolutionStatus: 'resolved' | 'unresolved' | 'pending') => {
      try {
        await monitorApi.resolve(conversationId, resolutionStatus);
        // Update local state optimistically
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            conversations: g.conversations.map((c) =>
              c._id === conversationId ? { ...c, resolutionStatus } : c
            ),
          }))
        );
      } catch {
        // ignore; next auto-refresh will correct state
      }
    },
    []
  );

  const urgentCount = groups.filter((g) => g.priorityStatus === 'urgent').length;
  const warningCount = groups.filter((g) => g.priorityStatus === 'warning').length;
  const normalCount = groups.filter((g) => g.priorityStatus === 'normal').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-on-surface">จอ Monitor</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {lastRefreshed
              ? `อัปเดตล่าสุด ${formatDateTime(lastRefreshed.toISOString())} · รีเฟรชอัตโนมัติใน ${countdown}s`
              : 'กำลังโหลด...'}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-container-high transition-colors"
        >
          <RefreshCw className="size-4" />
          รีเฟรช ({countdown}s)
        </button>
      </div>

      {/* Summary strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="กลุ่มด่วน" value={urgentCount} icon={Activity} accent="error" />
          <StatCard title="กลุ่มรอตอบ" value={warningCount} icon={Clock} accent="yellow" />
          <StatCard title="กลุ่มปกติ" value={normalCount} icon={CheckCircle2} accent="green" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface-container rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">ไม่มีกลุ่มที่ใช้งาน</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <MonitorGroupCard key={g._id} group={g} onResolve={handleResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

function MonitorGroupCard({
  group,
  onResolve,
}: {
  group: MonitorGroup;
  onResolve: (id: string, status: 'resolved' | 'unresolved' | 'pending') => void;
}) {
  const cfg = PRIORITY_CONFIG[group.priorityStatus];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-sm',
        cfg.borderCls
      )}
    >
      {/* Group header row */}
      <div className="flex items-start justify-between gap-4 p-5">
        {/* Left: status + name + counts */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                cfg.badgeCls
              )}
            >
              {cfg.dot} {cfg.label}
            </span>
            {group.oldestPendingMs != null && (
              <span className="text-xs font-bold text-on-surface-variant">
                รอ {formatMs(group.oldestPendingMs)}
              </span>
            )}
          </div>

          <p className="text-base font-headline font-extrabold text-on-surface truncate">
            {group.name}
          </p>

          <p className="text-xs text-on-surface-variant">
            {group.slowCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-bold">{group.slowCount} ช้า · </span>
            )}
            {group.waitingCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">{group.waitingCount} รอ · </span>
            )}
            {group.openConvCount} สนทนาเปิดอยู่
          </p>
        </div>

        {/* Right: employees + last activity + expand toggle */}
        <div className="text-right flex-shrink-0 space-y-2">
          <EmployeeChips employees={group.assignedEmployees} />
          {group.lastActivityAt && (
            <p className="text-[10px] text-on-surface-variant">
              {formatDateTime(group.lastActivityAt)}
            </p>
          )}
          {group.conversations.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? 'ซ่อน' : 'ดูสนทนา'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable conversation list */}
      {expanded && group.conversations.length > 0 && (
        <div className="border-t border-surface-container-high/30 px-5 pb-4 pt-3 space-y-2">
          {group.conversations.map((conv, idx) => (
            <ConversationRow
              key={conv._id}
              conv={conv}
              index={idx + 1}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conv,
  index,
  onResolve,
}: {
  conv: MonitorConversation;
  index: number;
  onResolve: (id: string, status: 'resolved' | 'unresolved' | 'pending') => void;
}) {
  const rsCfg = RESPONSE_STATUS_CONFIG[conv.responseStatus];
  const isResolved = conv.resolutionStatus === 'resolved';

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm',
        isResolved
          ? 'bg-emerald-500/5 text-on-surface/50'
          : 'bg-surface-container'
      )}
    >
      {/* Left: index + status + pending time + AI badge */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span className="text-[10px] font-bold text-on-surface-variant w-4 flex-shrink-0">
          #{index}
        </span>
        <span className={cn('text-[10px] font-bold', rsCfg.cls)}>{rsCfg.label}</span>
        {conv.pendingMs > 0 && (
          <span className="text-[10px] text-on-surface-variant">รอ {formatMs(conv.pendingMs)}</span>
        )}
        {conv.lastCustomerMessageAt && (
          <span className="text-[10px] text-on-surface-variant hidden sm:inline">
            · {formatDateTime(conv.lastCustomerMessageAt)}
          </span>
        )}
        {conv.aiResolutionSuggestion && conv.resolutionStatus === 'pending' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
              conv.aiResolutionSuggestion === 'unresolved'
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
            )}
          >
            <Bot className="size-2.5" />
            AI: {conv.aiResolutionSuggestion === 'unresolved' ? 'ยังไม่จบ' : 'น่าจะจบแล้ว'}
          </span>
        )}
      </div>

      {/* Right: resolution buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {conv.resolutionStatus !== 'resolved' ? (
          <button
            onClick={() => onResolve(conv._id, 'resolved')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="size-3" />
            จบแล้ว
          </button>
        ) : (
          <button
            onClick={() => onResolve(conv._id, 'pending')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-[10px] font-bold hover:bg-surface-container-high/80 transition-colors"
          >
            <Minus className="size-3" />
            ยกเลิก
          </button>
        )}
        {conv.resolutionStatus !== 'unresolved' ? (
          <button
            onClick={() => onResolve(conv._id, 'unresolved')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors"
          >
            <X className="size-3" />
            ยังไม่จบ
          </button>
        ) : (
          <button
            onClick={() => onResolve(conv._id, 'pending')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-[10px] font-bold hover:bg-surface-container-high/80 transition-colors"
          >
            <Minus className="size-3" />
            ยกเลิก
          </button>
        )}
      </div>
    </div>
  );
}

function EmployeeChips({ employees }: { employees: MonitorEmployee[] }) {
  if (employees.length === 0) {
    return <span className="text-[10px] text-on-surface-variant">ไม่มีพนักงาน</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {employees.map((emp) => (
        <span
          key={emp._id}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold"
          title={`${emp.name} (${emp.employeeCode})`}
        >
          {emp.name.charAt(0)}
        </span>
      ))}
    </div>
  );
}
