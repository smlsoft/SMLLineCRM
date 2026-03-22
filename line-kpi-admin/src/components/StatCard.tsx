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
    <div className="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high/30 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{title}</span>
        {Icon && (
          <div className={cn('p-2 rounded-xl', accentMap[accent])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-headline font-extrabold text-on-surface">{value}</div>
      {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
    </div>
  );
}
