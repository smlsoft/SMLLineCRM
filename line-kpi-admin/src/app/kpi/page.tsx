'use client';

import { useEffect, useState } from 'react';
import { kpiApi, groupsApi, kpiLeaderboardApi } from '@/lib/api';
import type { KpiRecord, CustomerGroup, KpiTrendPoint } from '@/types/api';
import { formatMs, todayISO } from '@/lib/utils';
import { KpiScoreBadge } from '@/components/KpiScoreBadge';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

export default function KpiPage() {
  const [kpis, setKpis] = useState<KpiRecord[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedGroup, setSelectedGroup] = useState('');
  const [detailKpi, setDetailKpi] = useState<KpiRecord | null>(null);
  const [trend, setTrend] = useState<KpiTrendPoint[]>([]);

  useEffect(() => {
    groupsApi.list().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    kpiApi
      .list({ date: selectedDate, groupId: selectedGroup || undefined })
      .then(setKpis)
      .catch(() => setKpis([]))
      .finally(() => setLoading(false));
  }, [selectedDate, selectedGroup]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-headline font-extrabold text-on-surface">รายงาน KPI</h1>

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

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container-low/50">
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">พนักงาน</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">กลุ่ม</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">Case จบแล้ว</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">สนทนา</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">ข้อความ</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">First Response Rate</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">เวลาตอบเฉลี่ย</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">คะแนน KPI</th>
              <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-4 py-3">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-4 py-2">
                    <div className="h-10 bg-surface-container rounded-2xl animate-pulse" />
                  </td>
                </tr>
              ))
            ) : kpis.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-on-surface-variant py-12">
                  ไม่มีข้อมูล KPI สำหรับวันที่เลือก
                </td>
              </tr>
            ) : (
              kpis.map((kpi) => (
                <tr key={kpi._id} className="border-b border-surface-container-low/50 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-on-surface">
                    <div className="flex items-center gap-2">
                      <span>{kpi.employeeId.name}</span>
                      <span className="bg-surface-container-low text-on-surface-variant rounded-full text-[10px] font-bold px-2.5 py-0.5">
                        {kpi.employeeId.employeeCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {kpi.customerGroupId.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {kpi.resolvedCases ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {kpi.conversationsHandled}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {kpi.messagesSent}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {kpi.firstResponseRate !== undefined
                      ? `${Math.round(kpi.firstResponseRate * 100)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {formatMs(kpi.avgResponseMs)}
                  </td>
                  <td className="px-4 py-3">
                    <KpiScoreBadge score={kpi.qualityScore} status={kpi.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-primary text-sm font-bold hover:underline transition-all active:scale-95"
                      onClick={() => {
                        setDetailKpi(kpi);
                        setTrend([]);
                        kpiLeaderboardApi
                          .trend({ employeeId: kpi.employeeId._id, weeks: 8 })
                          .then(setTrend)
                          .catch(() => {});
                      }}
                    >
                      ดู
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      {detailKpi !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailKpi(null)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-lg mx-4 bg-surface-container-lowest border-surface-container-high rounded-3xl shadow-xl p-6 space-y-5">
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-lg font-headline font-extrabold text-on-surface">
                {detailKpi.employeeId.name} - {detailKpi.date}
              </h2>
              <p className="text-sm text-on-surface-variant">รายละเอียด KPI</p>
            </div>

            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={() => setDetailKpi(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 rounded-2xl p-4 col-span-2">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Case ที่จบแล้ว</p>
                <p className="text-3xl font-headline font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  {detailKpi.resolvedCases ?? 0}
                  <span className="text-sm font-normal text-emerald-600/60 ml-2">/ {detailKpi.conversationsHandled} case</span>
                </p>
              </div>
              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ข้อความที่ส่ง</p>
                <p className="text-xl font-headline font-extrabold text-on-surface mt-1">
                  {detailKpi.messagesSent}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">เวลาตอบเฉลี่ย</p>
                <p className="text-xl font-headline font-extrabold text-on-surface mt-1">
                  {formatMs(detailKpi.avgResponseMs)}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">First Response Rate</p>
                <p className="text-xl font-headline font-extrabold text-on-surface mt-1">
                  {detailKpi.firstResponseRate !== undefined
                    ? `${Math.round(detailKpi.firstResponseRate * 100)}%`
                    : '—'}
                </p>
              </div>
            </div>

            {/* AI evaluation section */}
            {detailKpi.status === 'complete' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-on-surface-variant">คะแนนคุณภาพ:</span>
                  <KpiScoreBadge score={detailKpi.qualityScore} status={detailKpi.status} />
                </div>

                {detailKpi.kpiNarrative && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">สรุปผลการประเมิน</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {detailKpi.kpiNarrative}
                    </p>
                  </div>
                )}

                {detailKpi.strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">จุดเด่น</p>
                    <ul className="space-y-1.5">
                      {detailKpi.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="bg-emerald-500/10 text-emerald-600 rounded-lg px-2.5 py-1">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailKpi.areasToImprove.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">จุดที่ควรปรับปรุง</p>
                    <ul className="space-y-1.5">
                      {detailKpi.areasToImprove.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="bg-amber-500/10 text-amber-600 rounded-lg px-2.5 py-1">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {detailKpi.status === 'pending' && (
              <div className="bg-amber-500/10 text-amber-600 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold">รอประมวลผล AI</p>
              </div>
            )}

            {detailKpi.status === 'failed' && (
              <div className="bg-error/10 text-error rounded-2xl p-4 text-center">
                <p className="text-sm font-bold">ประมวลผลไม่สำเร็จ</p>
              </div>
            )}

            {/* Trend chart */}
            {trend.length > 1 && (
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  แนวโน้ม 8 สัปดาห์ที่ผ่านมา
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trend} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-container-high)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 9, fill: 'var(--on-surface-variant)' }}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--on-surface-variant)' }} tickLine={false} />
                    <Tooltip
                      formatter={(v, name) => [
                        v,
                        name === 'avgQualityScore' ? 'คะแนน KPI' : 'Case จบแล้ว (เฉลี่ย)',
                      ]}
                      contentStyle={{ borderRadius: '0.75rem', border: 'none', fontSize: 11 }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} formatter={(name) => name === 'avgQualityScore' ? 'คะแนน KPI' : 'Case จบแล้ว'} />
                    <Line
                      type="monotone"
                      dataKey="avgResolvedCases"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="avgQualityScore"
                      stroke="var(--m3-primary)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
