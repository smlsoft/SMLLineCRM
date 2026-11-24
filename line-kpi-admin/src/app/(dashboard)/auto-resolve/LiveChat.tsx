'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { messagesApi } from '@/lib/api';
import type { AutoResolveSnapshotMessage } from '@/types/api';
import { ChatSnapshot } from './ChatSnapshot';

/**
 * Reads the conversation's real messages when shown (like /monitor), nothing stored, and marks the
 * moment the rule or AI checked it. Shows `fallback` (the chat saved with the log) only if the live
 * load fails.
 */
export function LiveChat({
  conversationId,
  markerAt,
  fallback,
  className,
}: {
  conversationId: string;
  markerAt?: string;
  fallback?: AutoResolveSnapshotMessage[];
  className?: string;
}) {
  const [messages, setMessages] = useState<AutoResolveSnapshotMessage[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setMessages(null);
    setError('');
    messagesApi
      .list(conversationId)
      .then((rows) => {
        if (!alive) return;
        setMessages(
          rows.map((m) => ({
            senderType: m.senderType,
            senderDisplayName: m.senderDisplayName,
            messageType: m.messageType,
            ...(m.textContent ? { textContent: m.textContent } : {}),
            timestamp: m.timestamp,
          }))
        );
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'โหลดบทสนทนาไม่สำเร็จ');
      });
    return () => {
      alive = false;
    };
  }, [conversationId]);

  if (error) {
    return fallback && fallback.length > 0 ? (
      <div className="space-y-1">
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          โหลดบทสนทนาจริงไม่สำเร็จ แสดงข้อความที่บันทึกไว้ตอนตรวจแทน
        </p>
        <ChatSnapshot scrollKey={`${conversationId}-saved`} messages={fallback} className={className} />
      </div>
    ) : (
      <p className="text-xs text-error text-center py-6">โหลดบทสนทนาไม่สำเร็จ: {error}</p>
    );
  }

  if (messages === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" /> กำลังโหลดบทสนทนา…
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="text-xs text-on-surface-variant text-center py-6">ไม่พบข้อความในบทสนทนานี้</p>;
  }

  return (
    <ChatSnapshot
      scrollKey={`${conversationId}-${messages.length}`}
      messages={messages}
      markerAt={markerAt}
      className={className}
    />
  );
}
