'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { formatLayer1Summary, layer1Api } from '@/lib/api';
import { cn } from '@/lib/utils';

const POLL_MS = 2000;

type CheckMessage = { kind: 'info' | 'ok' | 'error'; text: string };

/**
 * "Check now" for the refresh button on /monitor and /auto-resolve: asks the Layer 1 worker for a
 * background pass, polls its status without blocking the page, and calls onFinished when it ends.
 */
export function useLayer1Check(onFinished: () => void) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<CheckMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const poll = useCallback(() => {
    timer.current = setTimeout(async () => {
      try {
        const st = await layer1Api.status();
        if (st.running) {
          poll();
          return;
        }
        setChecking(false);
        if (st.lastError) setMessage({ kind: 'error', text: `ตรวจไม่สำเร็จ: ${st.lastError}` });
        else if (st.lastSummary) setMessage({ kind: 'ok', text: `ตรวจเสร็จ · ${formatLayer1Summary(st.lastSummary)}` });
        else setMessage(null);
        onFinishedRef.current();
      } catch (err) {
        setChecking(false);
        setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'อ่านสถานะการตรวจไม่ได้' });
      }
    }, POLL_MS);
  }, []);

  const trigger = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setMessage({ kind: 'info', text: 'กำลังตรวจเบื้องหลัง… ใช้หน้าจอต่อได้ตามปกติ' });
    try {
      await layer1Api.checkNow();
      poll();
    } catch (err) {
      setChecking(false);
      setMessage({ kind: 'error', text: `สั่งตรวจไม่ได้: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, [checking, poll]);

  return { checking, message, clearMessage: () => setMessage(null), trigger };
}

export function Layer1CheckBanner({ message, onClose }: { message: CheckMessage | null; onClose: () => void }) {
  if (!message) return null;
  const Icon = message.kind === 'info' ? Loader2 : message.kind === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 px-4 py-2.5 rounded-xl text-sm border',
        message.kind === 'info' && 'bg-surface-container border-surface-container-high text-on-surface',
        message.kind === 'ok' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        message.kind === 'error' && 'bg-error/10 border-error/20 text-error'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn('size-4 flex-shrink-0', message.kind === 'info' && 'animate-spin')} />
        <span className="break-words">{message.text}</span>
      </div>
      {message.kind !== 'info' && (
        <button onClick={onClose} className="p-1 rounded-xl hover:bg-black/5 flex-shrink-0" aria-label="ปิดข้อความ">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
