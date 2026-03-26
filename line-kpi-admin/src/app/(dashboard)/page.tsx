'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '@/components/StatCard';
import { groupsApi, monitorApi, dailyReportApi } from '@/lib/api';
import { todayISO } from '@/lib/utils';
import type { CustomerGroup, MonitorGroup, DailyReport } from '@/types/api';
import { MessageSquare, Users, AlertTriangle, FileText } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [monitorGroups, setMonitorGroups] = useState<MonitorGroup[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const today = todayISO();

  useEffect(() => {
    Promise.all([
      groupsApi.list(),
      monitorApi.get(),
      dailyReportApi.getSummary(today),
    ])
      .then(([g, m, dr]) => {
        setGroups(g);
        setMonitorGroups(m);
        setDailyReport(dr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [today]);

  const activeGroupCount = groups.filter((g) => g.isActive).length;
  const urgentCount = monitorGroups.filter((g) => g.priorityStatus === 'urgent').length;
  const totalOpenConvs = monitorGroups.reduce((s, g) => s + g.openConvCount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">แดชบอร์ด</h1>
        <p className="text-xs text-on-surface-variant mt-1">{today}</p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface-container rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="กลุ่มที่ใช้งาน" value={activeGroupCount} icon={Users} accent="primary" />
          <StatCard title="บทสนทนาที่เปิดอยู่" value={totalOpenConvs} icon={MessageSquare} accent="green" />
          <StatCard title="กลุ่มเร่งด่วน" value={urgentCount} icon={AlertTriangle} accent="yellow" />
          <StatCard title="Job วันนี้" value={dailyReport?.jobCount ?? '—'} icon={FileText} accent="primary" />
        </div>
      )}

      {/* Daily Report Summary */}
      {dailyReport && dailyReport.status === 'complete' && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              สรุปรายวัน — {today}
            </h3>
            <Link
              href="/summaries"
              className="text-xs font-bold text-primary hover:underline"
            >
              ดูรายละเอียด →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <div className="bg-surface-container rounded-2xl p-3">
              <p className="text-2xl font-extrabold text-on-surface">{dailyReport.groupCount}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">กลุ่มที่ติดต่อ</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-3">
              <p className="text-2xl font-extrabold text-on-surface">{dailyReport.jobCount}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Job/Case ทั้งหมด</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-3">
              <p className="text-2xl font-extrabold text-on-surface">{dailyReport.totalMessages}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">ข้อความทั้งหมด</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-3">
              <p className="text-2xl font-extrabold text-on-surface">{dailyReport.issueCategorySummary.length}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">ประเภทปัญหา</p>
            </div>
          </div>

          {dailyReport.issueCategorySummary.slice(0, 6).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dailyReport.issueCategorySummary.slice(0, 6).map((c) => (
                <span
                  key={c.category}
                  className="px-2.5 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold"
                >
                  {c.category} <span className="opacity-60">{c.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monitor Groups */}
      {monitorGroups.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-low">
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              สถานะกลุ่ม (Real-time)
            </h3>
          </div>
          <div className="divide-y divide-surface-container-low/50">
            {monitorGroups.map((g) => (
              <div
                key={g._id}
                className="flex items-center justify-between px-6 py-3 hover:bg-surface-container-low/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-on-surface">{g.name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    เปิดอยู่ {g.openConvCount} บทสนทนา
                    {g.waitingCount > 0 && ` · รอตอบ ${g.waitingCount}`}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                  g.priorityStatus === 'urgent'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : g.priorityStatus === 'warning'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {g.priorityStatus === 'urgent' ? 'เร่งด่วน' : g.priorityStatus === 'warning' ? 'ระวัง' : 'ปกติ'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
