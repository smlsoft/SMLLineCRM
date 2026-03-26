'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Bot, UserCheck,
  BarChart2, FileText, MessageSquare, Activity, Settings, Tag,
  Shield, UserCog, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { PermissionKey, UserInfo } from '@/types/api';
import { authApi } from '@/lib/api';
import { useState, useEffect } from 'react';

const navItems: { label: string; href: string; icon: React.ElementType; permission: PermissionKey }[] = [
  { label: 'แดชบอร์ด', href: '/', icon: LayoutDashboard, permission: 'dashboard' },
  { label: 'จอ Monitor', href: '/monitor', icon: Activity, permission: 'monitor' },
  { label: 'กลุ่มลูกค้า', href: '/groups', icon: Users, permission: 'groups' },
  { label: 'LINE OA', href: '/oas', icon: Bot, permission: 'oas' },
  { label: 'พนักงาน', href: '/employees', icon: UserCheck, permission: 'employees' },
  { label: 'สรุปรายวัน', href: '/summaries', icon: FileText, permission: 'summaries' },
  { label: 'ประเภทปัญหา', href: '/issue-categories', icon: Tag, permission: 'issue-categories' },
  { label: 'บทสนทนา', href: '/conversations', icon: MessageSquare, permission: 'conversations' },
  { label: 'ตั้งค่าระบบ', href: '/settings', icon: Settings, permission: 'settings' },
  { label: 'ผู้ใช้งาน', href: '/users', icon: UserCog, permission: 'users' },
  { label: 'กลุ่มสิทธิ์', href: '/permission-groups', icon: Shield, permission: 'permission-groups' },
];

function getUserInfo(): UserInfo | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)user-info=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as UserInfo;
  } catch {
    return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    setUserInfo(getUserInfo());
  }, []);

  const visibleItems = navItems.filter((item) => {
    if (!userInfo) return true; // ก่อน hydrate: show all (middleware handles protection)
    if (userInfo.isSuperAdmin) return true;
    return userInfo.permissions.includes(item.permission);
  });

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      router.push('/login');
    }
  }

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
      <nav className="flex-1 space-y-1 pr-4 overflow-y-auto">
        {visibleItems.map(({ label, href, icon: Icon }) => {
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
      <div className="pr-4 pt-4 border-t border-surface-container-high/50">
        {/* User info */}
        {userInfo && (
          <div className="px-4 py-2 mb-1">
            <p className="text-xs font-semibold text-on-surface truncate">{userInfo.displayName}</p>
            <p className="text-[10px] text-on-surface-variant truncate">
              {userInfo.isSuperAdmin ? 'Super Admin' : `@${userInfo.username}`}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-error transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'กำลังออก...' : 'ออกจากระบบ'}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
