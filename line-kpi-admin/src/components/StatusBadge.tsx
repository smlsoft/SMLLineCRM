import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  isActive?: boolean;
  status?: 'pending' | 'complete' | 'failed' | 'open' | 'closed';
  label?: string;
}

export function StatusBadge({ isActive, status, label }: StatusBadgeProps) {
  let text = label ?? '';
  let cls = '';

  if (status === 'complete' || isActive === true || status === 'open') {
    cls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    text = label ?? (status === 'open' ? 'เปิด' : 'สำเร็จ');
  } else if (status === 'pending') {
    cls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    text = label ?? 'รอดำเนินการ';
  } else if (status === 'failed' || isActive === false || status === 'closed') {
    cls = 'bg-surface-container-high text-on-surface-variant';
    text = label ?? (status === 'closed' ? 'ปิด' : isActive === false ? 'ไม่ใช้งาน' : 'ล้มเหลว');
  }

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', cls)}>
      {text}
    </span>
  );
}
