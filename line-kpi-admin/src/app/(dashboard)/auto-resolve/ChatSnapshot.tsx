'use client';

import { Fragment, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { File, Image as ImageIcon, MapPin, MessageSquare, Mic, Smile, Video } from 'lucide-react';
import type { AutoResolveSnapshotMessage } from '@/types/api';
import { cn } from '@/lib/utils';

const TZ = 'Asia/Bangkok';

const MEDIA_LABELS: Record<string, { icon: LucideIcon; label: string }> = {
  image: { icon: ImageIcon, label: 'รูปภาพ' },
  sticker: { icon: Smile, label: 'สติกเกอร์' },
  file: { icon: File, label: 'ไฟล์' },
  video: { icon: Video, label: 'วิดีโอ' },
  audio: { icon: Mic, label: 'ข้อความเสียง' },
  location: { icon: MapPin, label: 'ตำแหน่ง' },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: TZ,
  });
}

function MessageBody({ msg }: { msg: AutoResolveSnapshotMessage }) {
  if (msg.textContent) return <>{msg.textContent}</>;
  const media = MEDIA_LABELS[msg.messageType] ?? { icon: MessageSquare, label: msg.messageType };
  const Icon = media.icon;
  return (
    <span className="inline-flex items-center gap-1 italic opacity-80">
      <Icon className="size-3.5 flex-shrink-0" />
      {media.label}
    </span>
  );
}

/**
 * LINE-style read-only chat: customers on the left with avatar and name, staff on the right in green,
 * time beside each bubble, a divider per day. Opens scrolled to the newest message (or to the marker)
 * and scrolls again only when the entry or its message count changes, so it never fights a user who
 * scrolled up. With `markerAt`, a divider is drawn after the last message at or before that time and
 * later messages are dimmed.
 */
export function ChatSnapshot({
  scrollKey,
  messages,
  className,
  markerAt,
  markerLabel = 'ระบบตรวจตรงนี้ · ข้อความด้านล่างเข้ามาทีหลัง',
}: {
  scrollKey: string;
  messages: AutoResolveSnapshotMessage[];
  /** Overrides the default height cap (max-h-72), e.g. for a popup. */
  className?: string;
  /** ISO time the rule or AI checked the conversation. */
  markerAt?: string;
  markerLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const markerMs = markerAt ? new Date(markerAt).getTime() : NaN;
  // Index of the first message after the check; -1 when every message is at or before it.
  const afterIdx = Number.isNaN(markerMs)
    ? -1
    : messages.findIndex((m) => new Date(m.timestamp).getTime() > markerMs);
  const showMarker = !Number.isNaN(markerMs) && messages.length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mk = markerRef.current;
    if (mk && afterIdx >= 0) {
      // Put the divider about a third from the top: what was checked above, what came later below.
      el.scrollTop = Math.max(0, mk.offsetTop - el.offsetTop - el.clientHeight / 3);
    } else {
      el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const marker = (
    <div ref={markerRef} className="flex items-center gap-2 py-1.5" role="separator" aria-label={markerLabel}>
      <span className="h-px flex-1 bg-amber-500/60" />
      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
        {markerLabel}
      </span>
      <span className="h-px flex-1 bg-amber-500/60" />
    </div>
  );

  return (
    <div
      ref={ref}
      className={cn('bg-surface-container rounded-xl px-2.5 py-3 max-h-72 overflow-y-auto space-y-1.5', className)}
    >
      {messages.map((msg, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : undefined;
        const isEmployee = msg.senderType === 'employee';
        const newDay = !prev || dayKey(prev.timestamp) !== dayKey(msg.timestamp);
        const firstOfRun =
          newDay ||
          !prev ||
          prev.senderType !== msg.senderType ||
          prev.senderDisplayName !== msg.senderDisplayName;

        const isAfter = afterIdx >= 0 && idx >= afterIdx;
        return (
          <Fragment key={`${scrollKey}-${idx}`}>
          {showMarker && idx === afterIdx && marker}
          <div className={cn(firstOfRun && idx > 0 && 'pt-1.5', isAfter && 'opacity-50')}>
            {newDay && (
              <div className="flex justify-center py-1">
                <span className="text-[10px] text-on-surface-variant bg-surface-container-high/70 px-2.5 py-0.5 rounded-full">
                  {dayLabel(msg.timestamp)}
                </span>
              </div>
            )}

            <div className={cn('flex items-start gap-1.5', isEmployee && 'flex-row-reverse')}>
              {!isEmployee &&
                (firstOfRun ? (
                  <div
                    className="size-7 flex-shrink-0 rounded-full bg-surface-container-highest text-on-surface-variant text-[11px] font-bold flex items-center justify-center"
                    aria-hidden
                  >
                    {msg.senderDisplayName.trim().charAt(0) || '?'}
                  </div>
                ) : (
                  <div className="w-7 flex-shrink-0" />
                ))}

              <div className={cn('min-w-0 flex flex-col', isEmployee ? 'items-end' : 'items-start')}>
                {firstOfRun && (
                  <span className="text-[10px] text-on-surface-variant px-1 pb-0.5 truncate max-w-full">
                    {msg.senderDisplayName}
                  </span>
                )}
                <div className={cn('flex items-end gap-1', isEmployee && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs leading-relaxed break-words whitespace-pre-wrap max-w-[16rem]',
                      isEmployee
                        ? 'bg-emerald-500 text-white'
                        : 'bg-surface-container-lowest text-on-surface shadow-sm',
                      firstOfRun && (isEmployee ? 'rounded-tr-none' : 'rounded-tl-none')
                    )}
                  >
                    <MessageBody msg={msg} />
                  </div>
                  <span className="text-[9px] text-on-surface-variant flex-shrink-0 pb-0.5">
                    {timeLabel(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </Fragment>
        );
      })}
      {showMarker && afterIdx === -1 && marker}
    </div>
  );
}
