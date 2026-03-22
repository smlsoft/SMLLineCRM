'use client';

import { useCallback, useEffect, useState } from 'react';
import { summariesApi, groupsApi } from '@/lib/api';
import type { DailySummary, CustomerGroup } from '@/types/api';
import { formatMs, formatDateTime, todayISO } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Zap } from 'lucide-react';

export default function SummariesPage() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedGroup, setSelectedGroup] = useState('');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    groupsApi.list().then(setGroups).catch(() => {});
  }, []);

  const loadSummaries = useCallback(() => {
    setLoading(true);
    summariesApi
      .list({ date: selectedDate, groupId: selectedGroup || undefined })
      .then(setSummaries)
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }, [selectedDate, selectedGroup]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await summariesApi.trigger({ date: selectedDate });
      loadSummaries();
    } catch {
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">สรุปรายวัน</h1>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Zap className="size-4" />
          {triggering ? 'กำลังประมวลผล...' : 'ประมวลผลใหม่'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-row gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">ทุกกลุ่ม</option>
          {groups.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-on-surface-variant text-lg">ยังไม่มีสรุปสำหรับวันที่เลือก</p>
          <p className="text-on-surface-variant/70 text-sm">
            กด &apos;ประมวลผลใหม่&apos; เพื่อสร้างสรุป
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {summaries.map((summary) => (
            <div key={summary._id} className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-headline font-extrabold text-on-surface">
                  {summary.customerGroupId.name}
                </h2>
                <StatusBadge status={summary.status} />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-surface-container-low rounded-2xl px-4 py-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">บทสนทนา</span>
                  <p className="font-headline font-extrabold text-on-surface">
                    {summary.totalConversations}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-2xl px-4 py-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ข้อความ</span>
                  <p className="font-headline font-extrabold text-on-surface">
                    {summary.totalMessages}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-2xl px-4 py-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">เวลาตอบเฉลี่ย</span>
                  <p className="font-headline font-extrabold text-on-surface">
                    {formatMs(summary.avgResponseMs)}
                  </p>
                </div>
                {summary.sentimentScore !== undefined && (
                  <div className="bg-surface-container-low rounded-2xl px-4 py-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">อารมณ์</span>
                    <p className="font-headline font-extrabold text-on-surface">
                      {summary.sentimentScore}/10
                    </p>
                  </div>
                )}
              </div>

              {/* Summary text */}
              {summary.status === 'complete' && summary.summaryText && (
                <p className="text-sm text-on-surface-variant mt-4 leading-relaxed">
                  {summary.summaryText}
                </p>
              )}

              {/* Top issues */}
              {summary.topIssues.length > 0 && (
                <div className="mt-4">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mr-2">ปัญหาที่พบ</span>
                  <div className="inline-flex flex-wrap gap-1.5 mt-1.5">
                    {summary.topIssues.map((issue, i) => (
                      <span key={i} className="bg-primary/10 text-primary rounded-full text-[10px] font-bold px-2.5 py-0.5">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated timestamp */}
              {summary.generatedAt && (
                <p className="text-xs text-on-surface-variant mt-3">
                  ประมวลผลเมื่อ: {formatDateTime(summary.generatedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
