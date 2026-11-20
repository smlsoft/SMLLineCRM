'use client';

import { useEffect, useRef } from 'react';
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
 * time beside each bubble, a divider per day. Opens scrolled to the newest message and scrolls again
 * only when the entry or its message count changes, so it never fights a user who scrolled up.
 */
export function ChatSnapshot({
  scrollKey,
  messages,
}: {
  scrollKey: string;
  messages: AutoResolveSnapshotMessage[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollKey]);

  return (
    <div
      ref={ref}
      className="bg-surface-container rounded-xl px-2.5 py-3 max-h-72 overflow-y-auto space-y-1.5"
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

        return (
          <div key={`${scrollKey}-${idx}`} className={cn(firstOfRun && idx > 0 && 'pt-1.5')}>
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
        );
      })}
    </div>
  );
}
