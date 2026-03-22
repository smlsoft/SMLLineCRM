'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '@/components/StatCard';
import { KpiScoreBadge } from '@/components/KpiScoreBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { summariesApi, kpiApi, groupsApi, issueReportsApi } from '@/lib/api';
import { formatMs, todayISO } from '@/lib/utils';
import type { DailySummary, KpiRecord, CustomerGroup, IssueReport } from '@/types/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MessageSquare, Users, Clock, BarChart2, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

const TREND_COLORS: Record<string, string> = {
  new: '#8b5cf6',
  up: '#ef4444',
  down: '#22c55e',
  stable: '#64748b',
};

export default function DashboardPage() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [kpis, setKpis] = useState<KpiRecord[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [issueReports, setIssueReports] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);

  const today = todayISO();

  useEffect(() => {
    Promise.all([
      summariesApi.list({ date: today }),
      kpiApi.list({ date: today }),
      groupsApi.list(),
      issueReportsApi.list({ date: today }),
    ])
      .then(([s, k, g, ir]) => {
        setSummaries(s);
        setKpis(k);
        setGroups(g);
        setIssueReports(ir);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [today]);

  const totalMessages = summaries.reduce((sum, s) => sum + s.totalMessages, 0);
  const activeGroupCount = groups.filter((g) => g.isActive).length;

  const avgResponseMs = (() => {
    const valid = kpis.filter((k) => k.avgResponseMs != null);
    if (valid.length === 0) return undefined;
    return valid.reduce((sum, k) => sum + (k.avgResponseMs ?? 0), 0) / valid.length;
  })();

  const completeCount = kpis.filter((k) => k.status === 'complete').length;

  const chartData = kpis.map((k) => ({
    name: k.employeeId.name,
    messages: k.messagesSent,
  }));

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
          <StatCard title="ข้อความวันนี้" value={totalMessages} icon={MessageSquare} accent="primary" />
          <StatCard title="กลุ่มที่ใช้งาน" value={activeGroupCount} icon={Users} accent="green" />
          <StatCard title="เวลาตอบเฉลี่ย" value={formatMs(avgResponseMs)} icon={Clock} accent="yellow" />
          <StatCard title="ประเมิน KPI แล้ว" value={`${completeCount}/${kpis.length}`} icon={BarChart2} accent="primary" />
        </div>
      )}

      {/* Two-column: Chart + Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
            ข้อความที่ส่งแยกตามพนักงาน
          </h3>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-on-surface-variant text-sm">
              ยังไม่มีข้อมูล
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--surface-container-high)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--surface-container-high)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-container-lowest)',
                    border: '1px solid var(--surface-container-high)',
                    color: 'var(--on-surface)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="messages" fill="var(--m3-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary Cards */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
            สรุปรายกลุ่ม
          </h3>
          <div className="space-y-3">
            {summaries.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-on-surface-variant text-sm">
                ยังไม่มีข้อมูล
              </div>
            ) : (
              summaries.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/60 hover:bg-surface-container-low transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{s.customerGroupId.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {s.totalConversations} สนทนา / {s.totalMessages} ข้อความ
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Issues Today */}
      {issueReports.filter((r) => r.status === 'complete' && r.issueCategories.length > 0).length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-low flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              ปัญหาลูกค้าวันนี้
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {issueReports.filter((r) => r.status === 'complete').map((report) => {
              const top5 = report.issueCategories.slice(0, 5).map((c) => ({
                name: c.category, count: c.count, trend: c.trend,
              }));
              return (
                <div key={report._id} className="space-y-2">
                  <p className="text-xs font-bold text-on-surface">{report.customerGroupId.name}</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={top5} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-on-surface-variant" />
                      <Tooltip
                        formatter={(v) => [`${v} ครั้ง`, 'จำนวน']}
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', fontSize: 11 }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {top5.map((entry, i) => (
                          <Cell key={i} fill={TREND_COLORS[entry.trend] ?? '#6366f1'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Table */}
      {kpis.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-low">
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              ผลประเมิน KPI วันนี้
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container-low">
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">พนักงาน</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">กลุ่ม</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ข้อความ</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">เวลาตอบเฉลี่ย</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">คะแนน</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k._id} className="border-b border-surface-container-low/50 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-3 text-sm font-bold text-on-surface">{k.employeeId.name}</td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant">{k.customerGroupId.name}</td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant">{k.messagesSent}</td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant">{formatMs(k.avgResponseMs)}</td>
                  <td className="px-6 py-3"><KpiScoreBadge score={k.qualityScore} status={k.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
