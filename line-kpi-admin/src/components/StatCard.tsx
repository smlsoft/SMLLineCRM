import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: 'primary' | 'green' | 'yellow' | 'error';
}

export function StatCard({ title, value, subtitle, icon: Icon, accent = 'primary' }: StatCardProps) {
  const accentMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    error: 'bg-error/10 text-error',
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-3 md:p-5 border border-surface-container-high/30 shadow-sm">
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-1">
        <span className="text-[9px] md:text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight">{title}</span>
        {Icon && (
          <div className={cn('p-1.5 md:p-2 rounded-xl flex-shrink-0', accentMap[accent])}>
            <Icon className="w-3 h-3 md:w-4 md:h-4" />
          </div>
        )}
      </div>
      <div className="text-xl md:text-2xl font-headline font-extrabold text-on-surface">{value}</div>
      {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
    </div>
  );
}
