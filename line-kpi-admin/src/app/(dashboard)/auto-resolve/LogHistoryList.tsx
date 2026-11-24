'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, MessageSquare, X } from 'lucide-react';
import type { AutoResolveLog } from '@/types/api';
import { cn, formatDateTime } from '@/lib/utils';
import { LiveChat } from './LiveChat';
import { LayerBadge, LogOutcome, STATUS_CONFIG, StatusBadge, getGroupName } from './logParts';

/**
 * History as compact rows: everything but the chat is on the row. Clicking a row opens a popup
 * with the same details, the chat snapshot and the actions that log allows.
 */
export function LogHistoryList({
  logs,
  renderActions,
}: {
  logs: AutoResolveLog[];
  renderActions: (log: AutoResolveLog) => ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Looked up from the live list, so an action or a background refresh updates the popup too.
  const open = openId ? logs.find((l) => l._id === openId) ?? null : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <ul className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl shadow-sm overflow-hidden divide-y divide-surface-container-high/40">
        {logs.map((log) => {
          return (
            <li key={log._id}>
              <button
                type="button"
                onClick={() => setOpenId(log._id)}
                className={cn(
                  'w-full text-left border-l-4 px-4 py-3 flex items-start gap-3 hover:bg-surface-container/60 focus-visible:bg-surface-container/60 focus-visible:outline-none transition-colors',
                  STATUS_CONFIG[log.status].borderCls
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-headline font-bold text-on-surface truncate">{getGroupName(log)}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={log.status} />
                    <LayerBadge log={log} />
                  </div>
                  <p className="text-xs text-on-surface break-words">
                    <span className="font-bold text-on-surface-variant mr-1.5">เหตุผล:</span>
                    {log.reason}
                  </p>
                  <LogOutcome log={log} />
                </div>
                <div className="flex-shrink-0 text-right text-[10px] text-on-surface-variant space-y-0.5">
                  <p className="whitespace-nowrap">{formatDateTime(log.createdAt)}</p>
                  <p className="font-mono opacity-75 hidden sm:block">{log.proposedBy}</p>
                  <p className="inline-flex items-center gap-0.5 font-bold text-primary">
                    <MessageSquare className="size-3" />
                    ดูแชท
                    <ChevronRight className="size-3.5" />
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpenId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={getGroupName(open)}
            className={cn(
              'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col',
              STATUS_CONFIG[open.status].borderCls
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-5 space-y-3 overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={open.status} />
                    <LayerBadge log={open} />
                  </div>
                  <h2 className="text-base font-headline font-extrabold text-on-surface break-words">
                    {getGroupName(open)}
                  </h2>
                  <p className="text-[10px] text-on-surface-variant">
                    {formatDateTime(open.createdAt)} · <span className="font-mono">{open.proposedBy}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="ปิด"
                  className="p-1 rounded-xl hover:bg-surface-container text-on-surface-variant flex-shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="bg-surface-container px-3 py-2 rounded-xl text-xs text-on-surface break-words">
                <span className="font-bold text-on-surface-variant mr-1.5">เหตุผล:</span>
                {open.reason}
              </div>

              <LiveChat
                key={open._id}
                conversationId={open.conversationId}
                markerAt={open.lastMessageAtSnapshot}
                fallback={open.snapshotMessages}
                className="max-h-[50vh]"
              />
            </div>

            <div className="px-4 md:px-5 py-3 border-t border-surface-container-high/30 space-y-2">
              {renderActions(open)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
