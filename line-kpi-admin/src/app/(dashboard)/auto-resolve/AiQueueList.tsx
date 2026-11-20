'use client';

import { Bot } from 'lucide-react';
import type { TriageQueueEntry } from '@/types/api';
import { cn, formatDateTime } from '@/lib/utils';
import { ChatSnapshot } from './ChatSnapshot';

const QUEUE_STATUS = {
  queued: {
    label: 'รอ AI ตรวจ',
    badgeCls: 'bg-surface-container text-on-surface-variant',
    borderCls: 'border-l-slate-400',
  },
  needs_reply: {
    label: 'ยังไม่ได้ตอบ',
    badgeCls: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
    borderCls: 'border-l-red-500',
  },
} as const;

function groupName(e: TriageQueueEntry): string {
  return typeof e.customerGroupId === 'object' && e.customerGroupId !== null ? e.customerGroupId.name : e.lineGroupId;
}

/** Rooms in the Layer 2 (AI) queue — the same rooms /monitor badges "รอ AI ตรวจ" / "ยังไม่ได้ตอบ". */
export function AiQueueList({ entries }: { entries: TriageQueueEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl p-12 text-center space-y-2">
        <Bot className="size-10 mx-auto text-on-surface-variant/40" />
        <p className="text-base font-headline font-bold text-on-surface">ไม่มีห้องที่รอ AI ตรวจ</p>
        <p className="text-xs text-on-surface-variant">
          ห้องด่วนที่กฎขั้นที่ 1 ตัดสินไม่ได้จะมาอยู่ที่นี่ จนกว่า AI (ขั้นที่ 2) จะตรวจ
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
      {entries.map((e) => {
        const st = QUEUE_STATUS[e.triageStatus];
        return (
          <div
            key={e._id}
            className={cn(
              'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-sm p-4 md:p-5 flex flex-col gap-3',
              st.borderCls
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider',
                    st.badgeCls
                  )}
                >
                  <Bot className="size-3" /> {st.label}
                </span>
                <h2 className="text-base font-headline font-extrabold text-on-surface truncate">{groupName(e)}</h2>
              </div>
              <div className="text-right flex-shrink-0 text-[10px] text-on-surface-variant space-y-0.5">
                <p>เข้าคิว {formatDateTime(e.createdAt)}</p>
                {e.claimedBy && <p className="font-mono opacity-75">{e.claimedBy}</p>}
              </div>
            </div>

            <div className="bg-surface-container px-3 py-2 rounded-xl text-xs text-on-surface break-words space-y-1">
              <p>
                <span className="font-bold text-on-surface-variant mr-1.5">เหตุผลที่ส่งให้ AI:</span>
                {e.enqueueReason || '-'}
              </p>
              {e.triageStatus === 'needs_reply' && e.verdictReason && (
                <p>
                  <span className="font-bold text-on-surface-variant mr-1.5">AI:</span>
                  {e.verdictReason}
                  {typeof e.confidence === 'number' ? ` (${Math.round(e.confidence * 100)}%)` : ''}
                </p>
              )}
            </div>

            {e.snapshotMessages.length > 0 && (
              <ChatSnapshot scrollKey={`${e._id}-${e.snapshotMessages.length}`} messages={e.snapshotMessages} />
            )}
          </div>
        );
      })}
    </div>
  );
}
