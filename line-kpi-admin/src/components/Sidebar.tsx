'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Bot, UserCheck,
  BarChart2, FileText, MessageSquare, AlertTriangle, Activity, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { label: 'แดชบอร์ด', href: '/', icon: LayoutDashboard },
  { label: 'จอ Monitor', href: '/monitor', icon: Activity },
  { label: 'กลุ่มลูกค้า', href: '/groups', icon: Users },
  { label: 'LINE OA', href: '/oas', icon: Bot },
  { label: 'พนักงาน', href: '/employees', icon: UserCheck },
  { label: 'รายงาน KPI', href: '/kpi', icon: BarChart2 },
  { label: 'สรุปรายวัน', href: '/summaries', icon: FileText },
  { label: 'ปัญหาลูกค้า', href: '/issues', icon: AlertTriangle },
  { label: 'บทสนทนา', href: '/conversations', icon: MessageSquare },
  { label: 'ตั้งค่าระบบ', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 flex-shrink-0 bg-surface-container-low flex flex-col py-6 pl-4">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10 pl-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <BarChart2 className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-headline font-extrabold text-primary leading-tight">LINE KPI</h1>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Admin Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 pr-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ease-in-out group',
                active
                  ? 'bg-card text-primary font-semibold rounded-l-xl shadow-sm'
                  : 'text-on-surface/70 hover:text-primary hover:bg-card/50 rounded-l-xl'
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110', active && 'text-primary')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pr-4 pt-6 border-t border-surface-container-high/50">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Settings</p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
