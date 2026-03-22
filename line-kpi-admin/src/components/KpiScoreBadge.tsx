import { cn } from '@/lib/utils';

interface KpiScoreBadgeProps {
  score?: number;
  status?: string;
}

export function KpiScoreBadge({ score, status }: KpiScoreBadgeProps) {
  if (status !== 'complete' || score === undefined) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant">
        รอประมวลผล
      </span>
    );
  }

  const { cls, label } =
    score >= 9 ? { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: `${score} ดีเยี่ยม` } :
    score >= 7 ? { cls: 'bg-green-500/10 text-green-600 dark:text-green-400', label: `${score} ดี` } :
    score >= 5 ? { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: `${score} พอใช้` } :
                 { cls: 'bg-error/10 text-error', label: `${score} ต่ำกว่ามาตรฐาน` };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', cls)}>
      {label}
    </span>
  );
}
