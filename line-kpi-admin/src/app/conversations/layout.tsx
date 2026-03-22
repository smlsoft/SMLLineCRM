'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { conversationsApi } from '@/lib/api';
import type { Conversation } from '@/types/api';
import { formatMs } from '@/lib/utils';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

const PAGE_SIZE = 20;

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'เมื่อกี้';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok',
  });
}

function getGroupName(conv: Conversation): string {
  if (typeof conv.customerGroupId === 'string') return conv.customerGroupId;
  return conv.customerGroupId.name;
}

const filters = [
  { value: '',        label: 'ทั้งหมด',  activeCls: 'bg-primary text-on-primary' },
  { value: 'normal',  label: 'ปกติ',      activeCls: 'bg-emerald-600 text-white' },
  { value: 'waiting', label: 'รอตอบ',     activeCls: 'bg-blue-500 text-white' },
  { value: 'slow',    label: 'ตอบช้า',    activeCls: 'bg-error text-on-error' },
];

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const selectedId = pathname.match(/\/conversations\/(.+)/)?.[1] ?? null;

  const fetchConversations = useCallback(() => {
    setLoading(true);
    conversationsApi
      .grouped({ responseStatus: selectedFilter || undefined, page, limit: PAGE_SIZE })
      .then((res) => {
        setConvs(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
  }, [selectedFilter, page]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleFilterChange = (v: string) => {
    setSelectedFilter(v);
    setPage(1);
  };

  return (
    <div className="flex h-full overflow-hidden p-6 gap-6">
      {/* Column 1: Chat Groups (Queue) */}
      <section className="w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-lg text-on-surface">บทสนทนา</h2>
          <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            {total} กลุ่ม
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedFilter === f.value
                  ? f.activeCls
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-container rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-surface-container-high rounded w-1/3 mb-2" />
                <div className="h-4 bg-surface-container-high rounded w-2/3 mb-1" />
                <div className="h-3 bg-surface-container-high rounded w-full" />
              </div>
            ))
          ) : convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
              <MessageSquare className="w-8 h-8" />
              <span className="text-sm">ไม่มีบทสนทนา</span>
            </div>
          ) : (
            convs.map((conv) => {
              const name = getGroupName(conv);
              const isSelected = selectedId === conv._id;
              const isError = conv.responseStatus === 'slow';
              const isWaiting = conv.responseStatus === 'waiting';

              return (
                <button
                  key={conv._id}
                  onClick={() => router.push(`/conversations/${conv._id}`)}
                  className={`w-full text-left rounded-xl p-4 transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary/5 ring-1 ring-primary/20'
                      : isError
                        ? 'bg-error-container/10 border-l-4 border-error hover:shadow-md'
                        : 'bg-surface-container-lowest hover:bg-white/80'
                  } cursor-pointer`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isError ? 'text-error' : isWaiting ? 'text-blue-500' : isSelected ? 'text-primary' : 'text-on-surface-variant'
                    }`}>
                      {isError ? 'ตอบช้า' : isWaiting ? 'รอตอบ' : isSelected ? 'Active Chat' : 'ปกติ'}
                    </span>
                    <span className={`text-xs font-mono font-semibold ${isError ? 'text-error' : 'text-on-surface-variant'}`}>
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <h3 className="font-bold text-on-surface text-sm mb-1">{name}</h3>
                  <p className="text-xs text-on-surface-variant line-clamp-1">
                    {conv.messageCount} ข้อความ
                    {conv.avgResponseMs ? ` · ตอบ ${formatMs(conv.avgResponseMs)}` : ''}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-0.5 text-xs text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> ก่อนหน้า
            </button>
            <span className="text-[10px] font-bold text-on-surface-variant">{page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-0.5 text-xs text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ถัดไป <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Column 2: Chat Detail */}
      <section className="flex-1 bg-surface-container-lowest rounded-3xl flex flex-col shadow-sm border border-surface-container-high/30 min-w-0">
        {children}
      </section>
    </div>
  );
}
