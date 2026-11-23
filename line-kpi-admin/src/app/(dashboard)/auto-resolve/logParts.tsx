import { Bot, ShieldCheck } from 'lucide-react';
import type { AutoResolveLog, AutoResolveStatus } from '@/types/api';
import { cn, formatDateTime } from '@/lib/utils';

export const STATUS_CONFIG: Record<
  AutoResolveStatus,
  { label: string; dot: string; badgeCls: string; borderCls: string }
> = {
  pending_review: {
    label: 'รอตรวจสอบ',
    dot: '🟡',
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    borderCls: 'border-l-amber-400',
  },
  approved: {
    label: 'อนุมัติแล้ว',
    dot: '🟢',
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    borderCls: 'border-l-emerald-500',
  },
  auto_resolved: {
    label: 'ปิดอัตโนมัติ',
    dot: '⚡',
    badgeCls: 'bg-primary/10 text-primary',
    borderCls: 'border-l-primary',
  },
  rejected: {
    label: 'ปฏิเสธ (Logic พลาด)',
    dot: '🔴',
    badgeCls: 'bg-red-500/10 text-red-600 dark:text-red-400',
    borderCls: 'border-l-red-500',
  },
  reverted: {
    label: 'ยกเลิกย้อนหลัง',
    dot: '↩️',
    badgeCls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    borderCls: 'border-l-orange-400',
  },
  expired: {
    label: 'หมดอายุ (มีข้อความใหม่)',
    dot: '⚫',
    badgeCls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
    borderCls: 'border-l-zinc-400',
  },
};

export function getGroupName(log: AutoResolveLog): string {
  if (typeof log.customerGroupId === 'object' && log.customerGroupId !== null) {
    return log.customerGroupId.name;
  }
  return log.lineGroupId;
}

export function StatusBadge({ status }: { status: AutoResolveStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap',
        cfg.badgeCls
      )}
    >
      {cfg.dot} {cfg.label}
    </span>
  );
}

export function LayerBadge({ log }: { log: AutoResolveLog }) {
  if (log.layer === 'rule') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 whitespace-nowrap">
        <ShieldCheck className="size-3" />
        ชั้นที่ 1 · Rule{log.ruleCode ? ` (${log.ruleCode})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 whitespace-nowrap">
      <Bot className="size-3" />
      ชั้นที่ 2 · AI
      {typeof log.confidence === 'number' ? ` ${Math.round(log.confidence * 100)}%` : ''}
    </span>
  );
}

/** What happened to the proposal after it was made: who, when, and any note. null while pending. */
export function logOutcome(log: AutoResolveLog): { text: string; note?: string; noteIsError?: boolean } | null {
  const at = (d?: string | null) => (d ? ` · ${formatDateTime(d)}` : '');
  switch (log.status) {
    case 'approved':
      return { text: `อนุมัติโดย @${log.reviewedBy ?? '-'}${at(log.reviewedAt)}`, note: log.reviewNote ?? undefined };
    case 'auto_resolved':
      return { text: 'ปิดงานอัตโนมัติตามโหมด Auto' };
    case 'rejected':
      return {
        text: `ปฏิเสธโดย @${log.reviewedBy ?? '-'}${at(log.reviewedAt)}`,
        note: log.reviewNote ? `หมายเหตุ: ${log.reviewNote}` : undefined,
        noteIsError: true,
      };
    case 'reverted':
      return { text: `ยกเลิก Resolved โดย @${log.revertedBy ?? '-'}${at(log.revertedAt)}` };
    case 'expired':
      return { text: log.expiredReason ?? 'หมดอายุเนื่องจากมีข้อมูลอัปเดตใหม่' };
    default:
      return null;
  }
}

export function LogOutcome({ log }: { log: AutoResolveLog }) {
  const outcome = logOutcome(log);
  if (!outcome) return null;
  return (
    <p className="text-[11px] text-on-surface-variant break-words min-w-0">
      {outcome.text}
      {outcome.note && (
        <span className={cn('ml-1', outcome.noteIsError ? 'text-error' : 'text-on-surface')}>
          · {outcome.note}
        </span>
      )}
    </p>
  );
}
