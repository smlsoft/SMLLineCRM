'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { conversationsApi, messagesApi, employeesApi } from '@/lib/api';
import type { Conversation, Message, Employee } from '@/types/api';
import { formatDateTime } from '@/lib/utils';
import { Loader2, CheckCircle } from 'lucide-react';

const PAGE_SIZE = 50;

interface DayGroup {
  dateLabel: string;
  messages: Message[];
}

function groupByDay(messages: Message[]): DayGroup[] {
  const map = new Map<string, Message[]>();
  for (const msg of messages) {
    const bkk = new Date(new Date(msg.timestamp).getTime() + 7 * 60 * 60 * 1000);
    const day = bkk.toISOString().slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(msg);
  }
  return Array.from(map.entries()).map(([date, msgs]) => ({
    dateLabel: new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    messages: msgs,
  }));
}

function getGroupName(conv: Conversation): string {
  if (typeof conv.customerGroupId === 'string') return conv.customerGroupId;
  return conv.customerGroupId.name;
}

function getGroupId(conv: Conversation): string {
  if (typeof conv.customerGroupId === 'string') return conv.customerGroupId;
  return conv.customerGroupId._id;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [anchor, setAnchor] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [employeeIds, setEmployeeIds] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [responseStatusOverride, setResponseStatusOverride] = useState<'normal' | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const chatRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const oldestTimestampRef = useRef<string | undefined>(undefined);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    async function init() {
      setInitialLoading(true);
      setMessages([]);
      setHasMore(true);
      oldestTimestampRef.current = undefined;

      try {
        const [conv, employees] = await Promise.all([
          conversationsApi.get(id),
          employeesApi.list(),
        ]);

        setAnchor(conv);
        setGroupName(getGroupName(conv));
        setResponseStatusOverride(conv.responseStatusOverride ?? null);
        setEmployeeIds(new Set(employees.map((e: Employee) => e.lineUserId)));

        const gId = getGroupId(conv);
        setGroupId(gId);

        const latest = await messagesApi.listByGroup({ groupId: gId, limit: PAGE_SIZE });
        setMessages(latest);
        setHasMore(latest.length === PAGE_SIZE);

        if (latest.length > 0) {
          oldestTimestampRef.current = latest[0].timestamp;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, [id]);

  useEffect(() => {
    if (!initialLoading && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [initialLoading]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !groupId || !oldestTimestampRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const older = await messagesApi.listByGroup({
        groupId,
        before: oldestTimestampRef.current,
        limit: PAGE_SIZE,
      });

      if (older.length === 0) {
        setHasMore(false);
        return;
      }

      setHasMore(older.length === PAGE_SIZE);
      oldestTimestampRef.current = older[0].timestamp;

      const container = chatRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;

      setMessages((prev) => [...older, ...prev]);

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [groupId, hasMore]);

  const handleOverride = async (value: 'normal' | null) => {
    setOverriding(true);
    try {
      await conversationsApi.setResponseStatus(id, value);
      setResponseStatusOverride(value);
    } catch (err) {
      console.error(err);
    } finally {
      setOverriding(false);
    }
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { root: chatRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const dayGroups = groupByDay(messages);
  const effectiveStatus = responseStatusOverride === 'normal' ? 'normal' : anchor?.responseStatus;

  return (
    <>
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-surface-container-low flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">
              {groupName.slice(0, 2).toUpperCase()}
            </div>
            {effectiveStatus === 'normal' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-surface-container-lowest rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-on-surface text-base truncate">{groupName || '...'}</h2>
            {anchor && (
              <p className="text-xs text-on-surface-variant font-medium">
                {messages.length} ข้อความ
                {!hasMore && ' · โหลดครบแล้ว'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          {anchor && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              effectiveStatus === 'slow'
                ? 'bg-error-container/10 text-error'
                : effectiveStatus === 'waiting'
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              {effectiveStatus === 'slow' ? 'ตอบช้า' : effectiveStatus === 'waiting' ? 'รอตอบ' : 'ปกติ'}
            </span>
          )}

          {/* Override button */}
          {anchor && (
            responseStatusOverride === 'normal' ? (
              <button
                onClick={() => handleOverride(null)}
                disabled={overriding}
                className="p-2 rounded-xl hover:bg-surface-container-low transition-colors text-on-surface-variant text-xs disabled:opacity-50"
              >
                {overriding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ยกเลิก'}
              </button>
            ) : (
              <button
                onClick={() => handleOverride('normal')}
                disabled={overriding}
                className="p-2 rounded-xl hover:bg-primary/5 transition-colors text-primary font-bold text-xs uppercase tracking-wide flex items-center gap-1 disabled:opacity-50"
              >
                {overriding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Resolved
              </button>
            )
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            กำลังโหลด...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
            ไม่มีข้อความ
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
              </div>
            )}

            {!hasMore && !loadingMore && (
              <div className="flex justify-center py-4">
                <div className="h-px bg-surface-container-high w-16" />
                <span className="text-[10px] font-bold text-on-surface-variant/40 px-4 uppercase tracking-widest">เริ่มต้นบทสนทนา</span>
                <div className="h-px bg-surface-container-high w-16" />
              </div>
            )}

            {dayGroups.map((group) => (
              <div key={group.dateLabel} className="space-y-4">
                {/* Day divider */}
                <div className="flex justify-center">
                  <span className="text-[10px] font-bold bg-surface-container-high px-3 py-1 rounded-full text-on-surface-variant uppercase tracking-widest">
                    {group.dateLabel}
                  </span>
                </div>

                {/* Messages */}
                {group.messages.map((msg) => {
                  const isEmployee = employeeIds.has(msg.lineUserId);
                  const displayName = msg.employeeId?.name ?? msg.senderDisplayName ?? msg.lineUserId;

                  return isEmployee ? (
                    /* Agent message — right aligned */
                    <div key={msg._id} className="flex flex-row-reverse gap-3 max-w-[80%] ml-auto">
                      <div className="flex flex-col gap-1 items-end">
                        <span className="text-[10px] font-bold mr-1 text-primary">{displayName}</span>
                        <div className="bg-primary text-on-primary p-4 rounded-2xl rounded-br-none shadow-md shadow-primary/10 text-sm leading-relaxed">
                          {msg.messageType === 'text'
                            ? msg.textContent
                            : msg.messageType === 'image' && (msg.mediaId?.url || msg.mediaId?.data)
                              ? <img src={msg.mediaId.url ?? `data:${msg.mediaId.mimeType};base64,${msg.mediaId.data}`} alt="รูปภาพ" className="max-w-[220px] max-h-[220px] rounded-lg object-contain" />
                              : <span className="italic opacity-70">[{msg.messageType}]</span>
                          }
                        </div>
                        <span className="text-[10px] text-on-surface-variant/70 mt-1">
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Customer message — left aligned */
                    <div key={msg._id} className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant self-end mb-5 shrink-0">
                        {displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold ml-1 text-on-surface-variant">{displayName}</span>
                        <div className="bg-surface-container text-on-surface p-4 rounded-2xl rounded-bl-none shadow-sm text-sm leading-relaxed">
                          {msg.messageType === 'text'
                            ? msg.textContent
                            : msg.messageType === 'image' && (msg.mediaId?.url || msg.mediaId?.data)
                              ? <img src={msg.mediaId.url ?? `data:${msg.mediaId.mimeType};base64,${msg.mediaId.data}`} alt="รูปภาพ" className="max-w-[220px] max-h-[220px] rounded-lg object-contain" />
                              : <span className="italic text-on-surface-variant">[{msg.messageType}]</span>
                          }
                        </div>
                        <span className="text-[10px] text-on-surface-variant/70 text-right mt-1">
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
