'use client';

import { useCallback, useEffect, useState } from 'react';
import { issueReportsApi, groupsApi } from '@/lib/api';
import type { IssueReport, CustomerGroup } from '@/types/api';
import { todayISO, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Zap, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

const TREND_COLORS: Record<string, string> = {
  new: '#8b5cf6',
  up: '#ef4444',
  down: '#22c55e',
  stable: '#64748b',
};

const TREND_LABELS: Record<string, string> = {
  new: 'ใหม่',
  up: 'เพิ่มขึ้น',
  down: 'ลดลง',
  stable: 'เท่าเดิม',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="size-3 text-red-500" />;
  if (trend === 'down') return <TrendingDown className="size-3 text-green-500" />;
  if (trend === 'new') return <Sparkles className="size-3 text-violet-500" />;
  return <Minus className="size-3 text-slate-400" />;
}

export default function IssuesPage() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedGroup, setSelectedGroup] = useState('');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    groupsApi.list().then(setGroups).catch(() => {});
  }, []);

  const loadReports = useCallback(() => {
    setLoading(true);
    issueReportsApi
      .list({ date: selectedDate, groupId: selectedGroup || undefined })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [selectedDate, selectedGroup]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await issueReportsApi.trigger({ date: selectedDate });
      loadReports();
    } catch {
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">วิเคราะห์ปัญหาลูกค้า</h1>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Zap className="size-4" />
          {triggering ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}
        </button>
      </div>

      {/* Filters */}
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
            <option key={g._id} value={g._id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-on-surface-variant text-lg">ยังไม่มีข้อมูลสำหรับวันที่เลือก</p>
          <p className="text-on-surface-variant/70 text-sm">กด &apos;วิเคราะห์ใหม่&apos; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <IssueReportCard key={report._id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueReportCard({ report }: { report: IssueReport }) {
  const chartData = report.issueCategories.map((c) => ({
    name: c.category,
    count: c.count,
    percentage: c.percentage,
    trend: c.trend,
  }));

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-headline font-extrabold text-on-surface">
          {report.customerGroupId.name}
        </h2>
        <div className="flex items-center gap-2">
          {report.generatedAt && (
            <span className="text-xs text-on-surface-variant">
              ประมวลผลเมื่อ {formatDateTime(report.generatedAt)}
            </span>
          )}
          <StatusBadge status={report.status} />
        </div>
      </div>

      {report.status !== 'complete' ? (
        <p className="text-sm text-on-surface-variant">
          {report.status === 'pending' ? 'รอการประมวลผล...' : 'การประมวลผลล้มเหลว'}
        </p>
      ) : (
        <>
          {/* Bar chart */}
          {chartData.length > 0 && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                หมวดหมู่ปัญหาวันนี้
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-on-surface-variant"
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'count' ? `${value} ครั้ง` : `${value}%`,
                      name === 'count' ? 'จำนวน' : 'สัดส่วน',
                    ]}
                    contentStyle={{ borderRadius: '0.75rem', border: 'none', fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={TREND_COLORS[entry.trend] ?? '#6366f1'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category detail table */}
          <div className="space-y-2">
            {report.issueCategories.map((cat, i) => (
              <div key={i} className="flex items-start gap-3 bg-surface-container-low rounded-2xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-on-surface">{cat.category}</span>
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${TREND_COLORS[cat.trend]}20`, color: TREND_COLORS[cat.trend] }}
                    >
                      <TrendIcon trend={cat.trend} />
                      {TREND_LABELS[cat.trend]}
                    </span>
                  </div>
                  {cat.examples.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cat.examples.map((ex, j) => (
                        <span key={j} className="text-[10px] text-on-surface-variant bg-surface-container rounded-full px-2 py-0.5 truncate max-w-[200px]">
                          &ldquo;{ex}&rdquo;
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-headline font-extrabold text-on-surface">{cat.count}</p>
                  <p className="text-[10px] text-on-surface-variant">{cat.percentage}%</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recurring + Emerging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.recurringIssues.length > 0 && (
              <div className="bg-orange-500/10 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">
                  ปัญหาที่ซ้ำจากสัปดาห์ก่อน
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.recurringIssues.map((issue, i) => (
                    <span key={i} className="bg-orange-500/20 text-orange-700 text-[10px] font-bold rounded-full px-2.5 py-0.5">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.emergingIssues.length > 0 && (
              <div className="bg-violet-500/10 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-2">
                  ปัญหาใหม่ที่เพิ่งพบ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.emergingIssues.map((issue, i) => (
                    <span key={i} className="bg-violet-500/20 text-violet-700 text-[10px] font-bold rounded-full px-2.5 py-0.5">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Root cause insight */}
          {report.rootCauseInsight && (
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                วิเคราะห์สาเหตุ (AI)
              </p>
              <p className="text-sm text-on-surface leading-relaxed">{report.rootCauseInsight}</p>
            </div>
          )}

          {/* Recommended actions */}
          {report.recommendedActions.length > 0 && (
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                แนะนำแนวทางแก้ไข
              </p>
              <ul className="space-y-1.5">
                {report.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                    <span className="w-5 h-5 bg-primary/10 text-primary rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
