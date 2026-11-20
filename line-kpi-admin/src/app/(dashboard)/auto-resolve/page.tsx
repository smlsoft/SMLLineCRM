'use client';

import { useState, useEffect, useCallback } from 'react';
import { autoResolveApi } from '@/lib/api';
import { Layer1CheckBanner, useLayer1Check } from '@/components/Layer1Check';
import type {
  AutoResolveCounts,
  AutoResolveLayer,
  AutoResolveLog,
  AutoResolveMode,
  AutoResolveStatus,
  TriageQueueEntry,
} from '@/types/api';
import { cn, formatDateTime } from '@/lib/utils';
import { StatCard } from '@/components/StatCard';
import { ChatSnapshot } from './ChatSnapshot';
import { AiQueueList } from './AiQueueList';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

type ActiveTab = 'pending_review' | 'ai_queue' | 'all';

const REFRESH_INTERVAL = 30; // seconds, same as /monitor

const EMPTY_COUNTS: AutoResolveCounts = {
  pending_review: 0,
  approved: 0,
  rejected: 0,
  auto_resolved: 0,
  reverted: 0,
  expired: 0,
};

const STATUS_CONFIG: Record<
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

function getGroupName(log: AutoResolveLog): string {
  if (typeof log.customerGroupId === 'object' && log.customerGroupId !== null) {
    return log.customerGroupId.name;
  }
  return log.lineGroupId;
}

export default function AutoResolvePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending_review');
  const [statusFilter, setStatusFilter] = useState<AutoResolveStatus | 'all'>('all');
  const [layerFilter, setLayerFilter] = useState<'' | AutoResolveLayer>('');
  const [page, setPage] = useState(1);

  const [mode, setMode] = useState<AutoResolveMode>('review');
  const [counts, setCounts] = useState<AutoResolveCounts>(EMPTY_COUNTS);
  const [logs, setLogs] = useState<AutoResolveLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [queueEntries, setQueueEntries] = useState<TriageQueueEntry[]>([]);

  const [modeBusy, setModeBusy] = useState(false);
  const [confirmAutoOpen, setConfirmAutoOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, { open: boolean; note: string }>>({});

  const effectiveStatus: AutoResolveStatus | 'all' =
    activeTab === 'pending_review' ? 'pending_review' : statusFilter;

  // silent: background refresh, keeps the current cards on screen (no loading skeleton).
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, queue] = await Promise.all([
        autoResolveApi.listLogs({
          status: effectiveStatus,
          layer: layerFilter || undefined,
          page,
          limit: 20,
        }),
        autoResolveApi.listQueue(),
      ]);
      setQueueEntries(queue.data);
      setMode(res.mode);
      setCounts(res.counts);
      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!silent) setErrorMsg(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [effectiveStatus, layerFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Same cadence and countdown as /monitor, so a Resolved there or a staff reply shows here within 30 s.
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          loadData(true);
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loadData]);

  // Refresh = run the Layer 1 check now in the background (same as /monitor), then reload.
  const layer1Check = useLayer1Check(() => loadData(true));
  const handleManualRefresh = () => {
    setCountdown(REFRESH_INTERVAL);
    loadData();
    layer1Check.trigger();
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setPage(1);
    setErrorMsg('');
  };

  const handleToggleMode = async (nextMode: AutoResolveMode) => {
    setModeBusy(true);
    setErrorMsg('');
    try {
      const res = await autoResolveApi.setMode(nextMode);
      setMode(res.mode);
      setConfirmAutoOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เปลี่ยนโหมดไม่สำเร็จ');
    } finally {
      setModeBusy(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionBusy((prev) => ({ ...prev, [id]: true }));
    setErrorMsg('');
    try {
      await autoResolveApi.approve(id);
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'อนุมัติไม่สำเร็จ');
      await loadData();
    } finally {
      setActionBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleRejectConfirm = async (id: string) => {
    const note = rejectDrafts[id]?.note ?? '';
    setActionBusy((prev) => ({ ...prev, [id]: true }));
    setErrorMsg('');
    try {
      await autoResolveApi.reject(id, note);
      setRejectDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ปฏิเสธไม่สำเร็จ');
      await loadData();
    } finally {
      setActionBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleRevert = async (id: string) => {
    setActionBusy((prev) => ({ ...prev, [id]: true }));
    setErrorMsg('');
    try {
      await autoResolveApi.revert(id);
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ');
      await loadData();
    } finally {
      setActionBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const reviewedTotal = counts.approved + counts.rejected;
  const accuracyPct =
    reviewedTotal > 0 ? Math.round((counts.approved / reviewedTotal) * 100) : null;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header + Mode Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-on-surface flex items-center gap-2">
            <ClipboardCheck className="size-6 text-primary" />
            ตรวจสอบ Auto-Resolve
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            ตรวจความแม่นยำของการปิดงานจากระบบภายนอก ก่อนสลับเป็นโหมดปิดอัตโนมัติ
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {lastRefreshed
              ? `อัปเดตล่าสุด ${formatDateTime(lastRefreshed.toISOString())} · รีเฟรชอัตโนมัติใน ${countdown}s`
              : 'กำลังโหลด...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Current Mode Pill + Switch */}
          <div className="inline-flex items-center gap-2 bg-surface-container border border-surface-container-high px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-on-surface-variant">โหมดทำงาน:</span>
            {mode === 'review' ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                🟡 รอตรวจ (Review)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                🟢 อัตโนมัติ (Auto)
              </span>
            )}

            {mode === 'review' ? (
              <button
                onClick={() => setConfirmAutoOpen(true)}
                disabled={modeBusy}
                className="text-xs font-bold px-3 py-1 rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                เปิดโหมด Auto
              </button>
            ) : (
              <button
                onClick={() => handleToggleMode('review')}
                disabled={modeBusy}
                className="text-xs font-bold px-3 py-1 rounded-xl bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                {modeBusy ? 'กำลังเปลี่ยน...' : 'กลับเป็นโหมดรอตรวจ'}
              </button>
            )}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={loading || layer1Check.checking}
            className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('size-4', (loading || layer1Check.checking) && 'animate-spin')} />
            {layer1Check.checking ? 'กำลังตรวจ…' : `รีเฟรช (${countdown}s)`}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <StatCard
          title="รอตรวจสอบ"
          value={counts.pending_review}
          icon={Clock}
          accent="yellow"
        />
        <StatCard
          title="อนุมัติแล้ว"
          value={counts.approved}
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          title="ปิดอัตโนมัติ"
          value={counts.auto_resolved}
          icon={Zap}
          accent="primary"
        />
        <StatCard
          title="ปฏิเสธ (Logic พลาด)"
          value={counts.rejected}
          subtitle={accuracyPct !== null ? `แม่นยำช่วงตรวจ ${accuracyPct}%` : undefined}
          icon={XCircle}
          accent="error"
        />
      </div>

      {/* Inline Error Banner */}
      <Layer1CheckBanner message={layer1Check.message} onClose={layer1Check.clearMessage} />

      {errorMsg && (
        <div className="flex items-start justify-between gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="size-4 flex-shrink-0" />
            <span className="break-words">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="p-1 rounded-xl hover:bg-error/10 flex-shrink-0"
            aria-label="ปิดข้อความแจ้งเตือน"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleTabChange('pending_review')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
              activeTab === 'pending_review'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            รอตรวจสอบ ({counts.pending_review})
          </button>
          <button
            onClick={() => handleTabChange('ai_queue')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
              activeTab === 'ai_queue'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            รอ AI ตรวจ ({queueEntries.length})
          </button>
          <button
            onClick={() => handleTabChange('all')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
              activeTab === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            ประวัติ Log ทั้งหมด
          </button>
        </div>

        <div className={cn('flex flex-wrap items-center gap-2', activeTab === 'ai_queue' && 'hidden')}>
          {(
            [
              { value: '' as const, label: 'ทุกชั้น' },
              { value: 'rule' as const, label: 'ชั้นที่ 1 · กฎพื้นฐาน' },
              { value: 'ai' as const, label: 'ชั้นที่ 2 · AI' },
            ] as const
          ).map((chip) => (
            <button
              key={chip.value || 'all-layer'}
              onClick={() => {
                setLayerFilter(chip.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                layerFilter === chip.value
                  ? 'bg-on-surface text-surface-container-lowest'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              {chip.label}
            </button>
          ))}

          {activeTab === 'all' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AutoResolveStatus | 'all');
                setPage(1);
              }}
              className="bg-surface-container border border-surface-container-high text-on-surface text-xs font-medium px-3 py-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="pending_review">รอตรวจสอบ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="auto_resolved">ปิดอัตโนมัติ</option>
              <option value="rejected">ปฏิเสธ</option>
              <option value="reverted">ยกเลิกย้อนหลัง</option>
              <option value="expired">หมดอายุ</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 bg-surface-container rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'ai_queue' ? (
        <AiQueueList entries={queueEntries} />
      ) : logs.length === 0 ? (
        <div className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl p-12 text-center space-y-2">
          <ClipboardCheck className="size-10 mx-auto text-on-surface-variant/40" />
          <p className="text-base font-headline font-bold text-on-surface">
            {activeTab === 'pending_review'
              ? 'ไม่มีรายการค้างรอตรวจสอบ'
              : 'ยังไม่มีประวัติ Auto-Resolve'}
          </p>
          <p className="text-xs text-on-surface-variant">
            {activeTab === 'pending_review'
              ? 'เมื่อ smllinecrm-mcp ตรวจพบกลุ่มที่เข้าเงื่อนไขปิดงาน รายการจะมาแสดงที่นี่เพื่อให้ยืนยัน'
              : 'ลองเปลี่ยนตัวกรองสถานะหรือชั้นการวิเคราะห์ด้านบน'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
            {logs.map((log) => {
              const statusCfg = STATUS_CONFIG[log.status];
              const isBusy = !!actionBusy[log._id];
              const rejectState = rejectDrafts[log._id];

              return (
                <div
                  key={log._id}
                  className={cn(
                    'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-sm p-4 md:p-5 flex flex-col justify-between gap-3',
                    statusCfg.borderCls
                  )}
                >
                  <div className="space-y-3 min-w-0">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider',
                              statusCfg.badgeCls
                            )}
                          >
                            {statusCfg.dot} {statusCfg.label}
                          </span>

                          {log.layer === 'rule' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                              <ShieldCheck className="size-3" />
                              ชั้นที่ 1 · Rule{log.ruleCode ? ` (${log.ruleCode})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
                              <Bot className="size-3" />
                              ชั้นที่ 2 · AI
                              {typeof log.confidence === 'number'
                                ? ` ${Math.round(log.confidence * 100)}%`
                                : ''}
                            </span>
                          )}
                        </div>

                        <h2 className="text-base font-headline font-extrabold text-on-surface truncate">
                          {getGroupName(log)}
                        </h2>
                      </div>

                      <div className="text-right flex-shrink-0 text-[10px] text-on-surface-variant space-y-0.5">
                        <p>{formatDateTime(log.createdAt)}</p>
                        <p className="font-mono opacity-75">{log.proposedBy}</p>
                      </div>
                    </div>

                    {/* Reason Banner */}
                    <div className="bg-surface-container px-3 py-2 rounded-xl text-xs text-on-surface break-words">
                      <span className="font-bold text-on-surface-variant mr-1.5">เหตุผล:</span>
                      {log.reason}
                    </div>

                    {/* Chat Snapshot */}
                    {log.snapshotMessages && log.snapshotMessages.length > 0 && (
                      <ChatSnapshot
                        scrollKey={`${log._id}-${log.snapshotMessages.length}`}
                        messages={log.snapshotMessages}
                      />
                    )}
                  </div>

                  {/* Action / Audit Footer */}
                  <div className="pt-2 border-t border-surface-container-high/30 space-y-2">
                    {log.status === 'pending_review' && (
                      <>
                        {rejectState?.open ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rejectState.note}
                              onChange={(e) =>
                                setRejectDrafts((prev) => ({
                                  ...prev,
                                  [log._id]: { open: true, note: e.target.value },
                                }))
                              }
                              placeholder="ระบุเหตุผลที่ logic พลาด (ไม่บังคับ)"
                              className="w-full px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() =>
                                  setRejectDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[log._id];
                                    return next;
                                  })
                                }
                                disabled={isBusy}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                              >
                                ยกเลิก
                              </button>
                              <button
                                onClick={() => handleRejectConfirm(log._id)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="size-3.5" />
                                )}
                                ยืนยันปฏิเสธ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setRejectDrafts((prev) => ({
                                  ...prev,
                                  [log._id]: { open: true, note: '' },
                                }))
                              }
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="size-3.5" />
                              ปฏิเสธ
                            </button>
                            <button
                              onClick={() => handleApprove(log._id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                              ยืนยัน (Resolved)
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {(log.status === 'approved' || log.status === 'auto_resolved') && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-on-surface-variant">
                          {log.status === 'approved'
                            ? `อนุมัติโดย @${log.reviewedBy ?? '-'}${log.reviewedAt ? ` · ${formatDateTime(log.reviewedAt)}` : ''}${log.reviewNote ? ` · ${log.reviewNote}` : ''}`
                            : 'ปิดงานอัตโนมัติตามโหมด Auto'}
                        </span>
                        <button
                          onClick={() => handleRevert(log._id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          ยกเลิก Resolved
                        </button>
                      </div>
                    )}

                    {log.status === 'rejected' && (
                      <div className="text-[11px] text-on-surface-variant space-y-0.5 break-words">
                        <p>
                          ปฏิเสธโดย @{log.reviewedBy ?? '-'}
                          {log.reviewedAt ? ` · ${formatDateTime(log.reviewedAt)}` : ''}
                        </p>
                        {log.reviewNote && (
                          <p className="text-error">หมายเหตุ: {log.reviewNote}</p>
                        )}
                      </div>
                    )}

                    {log.status === 'reverted' && (
                      <p className="text-[11px] text-on-surface-variant">
                        ยกเลิก Resolved โดย @{log.revertedBy ?? '-'}
                        {log.revertedAt ? ` · ${formatDateTime(log.revertedAt)}` : ''}
                      </p>
                    )}

                    {log.status === 'expired' && (
                      <p className="text-[11px] text-on-surface-variant break-words">
                        {log.expiredReason ?? 'หมดอายุเนื่องจากมีข้อมูลอัปเดตใหม่'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-on-surface-variant">
                ทั้งหมด {total} รายการ · หน้า {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                  ก่อนหน้า
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
                >
                  ถัดไป
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal for Auto Mode */}
      {confirmAutoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !modeBusy && setConfirmAutoOpen(false)}
        >
          <div
            className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Zap className="size-5" />
                </div>
                <h2 className="text-base font-headline font-extrabold text-on-surface">
                  ยืนยันการเปิดโหมดอัตโนมัติ (Auto)
                </h2>
              </div>
              <button
                onClick={() => setConfirmAutoOpen(false)}
                disabled={modeBusy}
                className="p-1 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              เมื่อเปิดโหมดนี้ รายการใหม่ที่ผ่านเกณฑ์จาก Agent จะกด{' '}
              <strong className="text-on-surface">Resolved</strong> ให้ทันทีโดยไม่ต้องรอตรวจ
              (ทุกเคสยังถูกบันทึก Log และกดยกเลิกย้อนหลังได้เสมอ)
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmAutoOpen(false)}
                disabled={modeBusy}
                className="px-4 py-2 rounded-xl bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                ยังไม่เปิด
              </button>
              <button
                onClick={() => handleToggleMode('auto')}
                disabled={modeBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {modeBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                ยืนยันเปิดโหมด Auto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
