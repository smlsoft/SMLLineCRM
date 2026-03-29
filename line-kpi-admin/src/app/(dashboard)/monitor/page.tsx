'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { monitorApi, messagesApi, conversationsApi } from '@/lib/api';
import type { MonitorGroup, MonitorEmployee, MonitorConversation, EmployeeStatus, Message } from '@/types/api';
import { formatMs, formatDateTime, cn } from '@/lib/utils';
import { RefreshCw, Activity, Clock, CheckCircle2, ChevronDown, ChevronUp, X, MessageCircle, CheckCircle, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/StatCard';

const REFRESH_INTERVAL = 30;

type ActiveTab = 'groups' | 'employees';

const PRIORITY_CONFIG = {
  urgent: {
    borderCls: 'border-l-red-500',
    badgeCls: 'bg-red-500/10 text-red-600 dark:text-red-400',
    label: 'ด่วน',
    dot: '🔴',
  },
  warning: {
    borderCls: 'border-l-amber-400',
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'รอ',
    dot: '🟡',
  },
  normal: {
    borderCls: 'border-l-emerald-500',
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'ปกติ',
    dot: '🟢',
  },
} as const;

const RESPONSE_STATUS_CONFIG = {
  slow: { cls: 'text-red-600 dark:text-red-400', label: 'ช้า' },
  waiting: { cls: 'text-amber-600 dark:text-amber-400', label: 'รอ' },
  normal: { cls: 'text-emerald-600 dark:text-emerald-400', label: 'ปกติ' },
} as const;

const EMPLOYEE_STATUS_CONFIG = {
  active: {
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    borderCls: 'border-l-emerald-500',
    label: 'ใช้งาน',
    dot: '🟢',
  },
  idle: {
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    borderCls: 'border-l-amber-400',
    label: 'ว่าง',
    dot: '🟡',
  },
  away: {
    badgeCls: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
    borderCls: 'border-l-zinc-400',
    label: 'ไม่อยู่',
    dot: '⚫',
  },
} as const;

interface GroupModalState {
  groupId: string;
  groupName: string;
  employeeName: string;
}

export default function MonitorPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('groups');
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeStatus[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'idle' | 'away'>('');
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);
  const [groupConvModal, setGroupConvModal] = useState<MonitorGroup | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(() => {
    monitorApi
      .get()
      .then(setGroups)
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLastRefreshed(new Date());
      });
  }, []);

  const loadEmployees = useCallback(() => {
    monitorApi
      .getEmployees()
      .then(setEmployees)
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    loadEmployees();
  }, [loadData, loadEmployees]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          loadData();
          loadEmployees();
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loadData, loadEmployees]);

  const handleManualRefresh = () => {
    setCountdown(REFRESH_INTERVAL);
    loadData();
    loadEmployees();
  };

  const urgentCount = groups.filter((g) => g.priorityStatus === 'urgent').length;
  const warningCount = groups.filter((g) => g.priorityStatus === 'warning').length;
  const normalCount = groups.filter((g) => g.priorityStatus === 'normal').length;

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const idleCount   = employees.filter((e) => e.status === 'idle').length;
  const awayCount   = employees.filter((e) => e.status === 'away').length;

  const departments = Array.from(
    new Set(employees.map((e) => e.department ?? 'ไม่ระบุแผนก'))
  ).sort();

  const filteredEmployees = employees.filter((e) => {
    if (filterDept && (e.department ?? 'ไม่ระบุแผนก') !== filterDept) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-on-surface">จอ Monitor</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {lastRefreshed
              ? `อัปเดตล่าสุด ${formatDateTime(lastRefreshed.toISOString())} · รีเฟรชอัตโนมัติใน ${countdown}s`
              : 'กำลังโหลด...'}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-container-high transition-colors"
        >
          <RefreshCw className="size-4" />
          รีเฟรช ({countdown}s)
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('groups')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
            activeTab === 'groups'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          )}
        >
          กลุ่ม ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
            activeTab === 'employees'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          )}
        >
          พนักงาน ({employees.length})
        </button>
      </div>

      {/* Tab 1: Groups */}
      {activeTab === 'groups' && (
        <>
          {!loading && (
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <StatCard title="กลุ่มด่วน" value={urgentCount} icon={Activity} accent="error" />
              <StatCard title="กลุ่มรอตอบ" value={warningCount} icon={Clock} accent="yellow" />
              <StatCard title="กลุ่มปกติ" value={normalCount} icon={CheckCircle2} accent="green" />
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-surface-container rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">ไม่มีกลุ่มที่ใช้งาน</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {groups.map((g) => (
                <MonitorGroupCard key={g._id} group={g} onOpenModal={setGroupConvModal} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Employees */}
      {activeTab === 'employees' && (
        <>
          {/* Compact filter bar */}
          {!empLoading && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Status chips */}
              {(
                [
                  { value: '' as const,       dot: null,  label: 'ทั้งหมด', count: employees.length,   activeCls: 'bg-on-surface text-surface-container-lowest', inactiveCls: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high' },
                  { value: 'active' as const, dot: '🟢', label: 'ใช้งาน',  count: activeCount,         activeCls: 'bg-emerald-500 text-white',                    inactiveCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20' },
                  { value: 'idle' as const,   dot: '🟡', label: 'ว่าง',    count: idleCount,            activeCls: 'bg-amber-400 text-white',                      inactiveCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20' },
                  { value: 'away' as const,   dot: '⚫', label: 'ไม่อยู่', count: awayCount,            activeCls: 'bg-zinc-500 text-white',                       inactiveCls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/20' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setFilterStatus(chip.value === filterStatus ? '' : chip.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                    filterStatus === chip.value ? chip.activeCls : chip.inactiveCls
                  )}
                >
                  {chip.dot && <span className="text-[10px]">{chip.dot}</span>}
                  {chip.label}
                  <span className={cn('text-[10px] font-extrabold tabular-nums', filterStatus === chip.value ? 'opacity-80' : 'opacity-60')}>
                    {chip.count}
                  </span>
                </button>
              ))}

              {/* Divider */}
              {departments.length > 1 && (
                <span className="w-px h-4 bg-surface-container-high mx-1" />
              )}

              {/* Department dropdown */}
              {departments.length > 1 && (
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="bg-surface-container border border-surface-container-high text-on-surface text-xs font-medium px-3 py-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">ทุกแผนก</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              {/* Clear filters */}
              {(filterStatus || filterDept) && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterDept(''); }}
                  className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors underline underline-offset-2"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}

          {empLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-surface-container rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">ไม่มีพนักงาน</div>
          ) : (
            <EmployeeDepartmentGroups
              employees={filteredEmployees}
              filterDept={filterDept}
              onGroupClick={(groupId, groupName, employeeName) =>
                setGroupModal({ groupId, groupName, employeeName })
              }
            />
          )}
        </>
      )}

      {/* Employee → group messages modal */}
      {groupModal && (
        <GroupMessagesModal
          groupId={groupModal.groupId}
          groupName={groupModal.groupName}
          employeeName={groupModal.employeeName}
          onClose={() => setGroupModal(null)}
        />
      )}

      {/* Group card → conversation modal */}
      {groupConvModal && (
        <GroupConversationModal
          group={groupConvModal}
          onClose={() => setGroupConvModal(null)}
        />
      )}
    </div>
  );
}

function EmployeeDepartmentGroups({
  employees,
  filterDept,
  onGroupClick,
}: {
  employees: EmployeeStatus[];
  filterDept: string;
  onGroupClick: (groupId: string, groupName: string, employeeName: string) => void;
}) {
  // If filtered to one dept, skip department headers
  if (filterDept) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {employees.map((emp) => (
          <EmployeeStatusCard key={emp._id} employee={emp} onGroupClick={onGroupClick} />
        ))}
      </div>
    );
  }

  const grouped = employees.reduce<Record<string, EmployeeStatus[]>>((acc, emp) => {
    const dept = emp.department ?? 'ไม่ระบุแผนก';
    (acc[dept] ??= []).push(emp);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dept, emps]) => (
        <div key={dept}>
          <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            {dept} · {emps.length} คน
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {emps.map((emp) => (
              <EmployeeStatusCard key={emp._id} employee={emp} onGroupClick={onGroupClick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmployeeStatusCard({
  employee: emp,
  onGroupClick,
}: {
  employee: EmployeeStatus;
  onGroupClick: (groupId: string, groupName: string, employeeName: string) => void;
}) {
  const cfg = EMPLOYEE_STATUS_CONFIG[emp.status];

  const idleLabel =
    emp.idleMinutes == null
      ? 'ไม่มีกิจกรรมวันนี้'
      : emp.idleMinutes < 1
        ? 'เพิ่งตอบ'
        : `${Math.round(emp.idleMinutes)} นาทีที่แล้ว`;

  return (
    <div
      className={cn(
        'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-sm p-5 space-y-2',
        cfg.borderCls
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
            cfg.badgeCls
          )}
        >
          {cfg.dot} {cfg.label}
        </span>
        <span className="text-[10px] text-on-surface-variant font-mono">{emp.employeeCode}</span>
      </div>
      <p className="text-base font-headline font-extrabold text-on-surface truncate">{emp.name}</p>
      <p className="text-xs text-on-surface-variant">{idleLabel}</p>
      {emp.lastResponseGroupId && emp.lastResponseGroupName ? (
        <button
          onClick={() => onGroupClick(emp.lastResponseGroupId!, emp.lastResponseGroupName!, emp.name)}
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium truncate max-w-full"
          title="ดูบทสนทนาล่าสุด"
        >
          <MessageCircle className="size-3 flex-shrink-0" />
          <span className="truncate">{emp.lastResponseGroupName}</span>
        </button>
      ) : (
        <p className="text-[10px] text-on-surface-variant/50">—</p>
      )}
    </div>
  );
}

function GroupMessagesModal({
  groupId,
  groupName,
  employeeName,
  onClose,
}: {
  groupId: string;
  groupName: string;
  employeeName: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesApi
      .listByGroup({ groupId, limit: 30 })
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [groupId]);

  useEffect(() => {
    if (!loadingMsgs) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loadingMsgs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-container-high/30 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
              บทสนทนาล่าสุด · {employeeName}
            </p>
            <h2 className="text-base font-headline font-extrabold text-on-surface truncate">
              {groupName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ overflowAnchor: 'none' }}>
          {loadingMsgs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-10 rounded-2xl animate-pulse bg-surface-container',
                    i % 2 === 0 ? 'w-3/4' : 'w-2/3 ml-auto'
                  )}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant py-8">ไม่มีข้อความ</p>
          ) : (
            messages.map((msg) => {
              const isEmployee = msg.senderType === 'employee';
              const isHighlighted =
                isEmployee && msg.employeeId?.name === employeeName;
              return (
                <div
                  key={msg._id}
                  className={cn('flex flex-col gap-0.5', isEmployee ? 'items-end' : 'items-start')}
                >
                  <span className="text-[10px] text-on-surface-variant px-1">
                    {msg.senderDisplayName}
                  </span>
                  <div
                    className={cn(
                      'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                      isEmployee
                        ? isHighlighted
                          ? 'bg-primary text-on-primary rounded-tr-sm'
                          : 'bg-surface-container-high text-on-surface rounded-tr-sm'
                        : 'bg-surface-container text-on-surface rounded-tl-sm'
                    )}
                  >
                    {msg.textContent
                      ? msg.textContent
                      : msg.messageType === 'image' && msg.mediaId?.data
                        ? <img src={`data:${msg.mediaId.mimeType};base64,${msg.mediaId.data}`} alt="รูปภาพ" className="max-w-[200px] max-h-[200px] rounded-lg object-contain" />
                        : <span className="italic text-on-surface/50 text-xs">[{msg.messageType}]</span>
                    }
                  </div>
                  <span className="text-[9px] text-on-surface-variant/60 px-1">
                    {formatDateTime(msg.timestamp)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function GroupConversationModal({
  group,
  onClose,
}: {
  group: MonitorGroup;
  onClose: () => void;
}) {
  const cfg = PRIORITY_CONFIG[group.priorityStatus];
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState<Record<string, 'normal' | null>>({});
  const [overriding, setOverriding] = useState<Record<string, boolean>>({});

  const handleOverride = async (convId: string, value: 'normal' | null) => {
    setOverriding(prev => ({ ...prev, [convId]: true }));
    try {
      await conversationsApi.setResponseStatus(convId, value);
      setOverrides(prev => ({ ...prev, [convId]: value }));
    } catch {}
    finally {
      setOverriding(prev => ({ ...prev, [convId]: false }));
    }
  };

  useEffect(() => {
    messagesApi
      .listByGroup({ groupId: group._id, limit: 30 })
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [group._id]);

  useEffect(() => {
    if (!loadingMsgs) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loadingMsgs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-surface-container-high/30 rounded-3xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-container-high/30 flex-shrink-0">
          <div className="min-w-0">
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5', cfg.badgeCls)}>
              {cfg.dot} {cfg.label}
            </span>
            <h2 className="text-base font-headline font-extrabold text-on-surface truncate">{group.name}</h2>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ overflowAnchor: 'none' }}>
          {loadingMsgs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn('h-10 rounded-2xl animate-pulse bg-surface-container', i % 2 === 0 ? 'w-3/4' : 'w-2/3 ml-auto')} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant py-8">ไม่มีข้อความ</p>
          ) : (
            messages.map((msg) => {
              const isEmployee = msg.senderType === 'employee';
              return (
                <div key={msg._id} className={cn('flex flex-col gap-0.5', isEmployee ? 'items-end' : 'items-start')}>
                  <span className="text-[10px] text-on-surface-variant px-1">{msg.senderDisplayName}</span>
                  <div className={cn('max-w-[80%] px-3 py-2 rounded-2xl text-sm', isEmployee ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container text-on-surface rounded-tl-sm')}>
                    {msg.textContent
                      ? msg.textContent
                      : msg.messageType === 'image' && msg.mediaId?.data
                        ? <img src={`data:${msg.mediaId.mimeType};base64,${msg.mediaId.data}`} alt="รูปภาพ" className="max-w-[200px] max-h-[200px] rounded-lg object-contain" />
                        : <span className="italic text-xs opacity-60">[{msg.messageType}]</span>
                    }
                  </div>
                  <span className="text-[9px] text-on-surface-variant/60 px-1">{formatDateTime(msg.timestamp)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Resolved footer */}
        {(() => {
          const pending = group.conversations.filter(conv => {
            const effective = overrides[conv._id] === 'normal' ? 'normal' : conv.responseStatus;
            return effective !== 'normal' || overrides[conv._id] === 'normal';
          });
          if (pending.length === 0) return null;
          return (
            <div className="border-t border-surface-container-high/30 p-3 flex-shrink-0 space-y-1.5">
              {pending.map(conv => {
                const effective = overrides[conv._id] === 'normal' ? 'normal' : conv.responseStatus;
                const isResolved = overrides[conv._id] === 'normal';
                const isBusy = !!overriding[conv._id];
                const statusCfg = effective === 'slow'
                  ? { dot: '🔴', label: 'ด่วน', cls: 'text-red-600 dark:text-red-400' }
                  : effective === 'waiting'
                  ? { dot: '🟡', label: 'รอ', cls: 'text-amber-600 dark:text-amber-400' }
                  : { dot: '🟢', label: 'ปกติ', cls: 'text-emerald-600 dark:text-emerald-400' };
                return (
                  <div key={conv._id} className="flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-1.5 text-xs min-w-0">
                      <span>{statusCfg.dot}</span>
                      <span className={cn('font-semibold', statusCfg.cls)}>{statusCfg.label}</span>
                      {conv.pendingMs > 0 && !isResolved && (
                        <span className="text-on-surface-variant">– รอ {formatMs(conv.pendingMs)}</span>
                      )}
                    </div>
                    {isResolved ? (
                      <button
                        onClick={() => handleOverride(conv._id, null)}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded-xl hover:bg-surface-container-low transition-colors text-on-surface-variant disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'ยกเลิก'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOverride(conv._id, 'normal')}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded-xl hover:bg-primary/5 transition-colors text-primary font-bold uppercase tracking-wide flex items-center gap-1 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle className="w-3.5 h-3.5" /> Resolved</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function MonitorGroupCard({
  group,
  onOpenModal,
}: {
  group: MonitorGroup;
  onOpenModal: (group: MonitorGroup) => void;
}) {
  const cfg = PRIORITY_CONFIG[group.priorityStatus];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'bg-surface-container-lowest border border-surface-container-high/30 border-l-4 rounded-3xl shadow-sm',
        cfg.borderCls
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 md:p-5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                cfg.badgeCls
              )}
            >
              {cfg.dot} {cfg.label}
            </span>
            {group.oldestPendingMs != null && (
              <span className="text-xs font-bold text-on-surface-variant">
                รอ {formatMs(group.oldestPendingMs)}
              </span>
            )}
          </div>

          <button
            onClick={() => onOpenModal(group)}
            className="flex items-center gap-1.5 text-base font-headline font-extrabold text-on-surface hover:text-primary transition-colors truncate max-w-full text-left group"
          >
            <MessageCircle className="size-3.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            <span className="truncate">{group.name}</span>
          </button>

          <p className="text-xs text-on-surface-variant">
            {group.slowCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-bold">{group.slowCount} ช้า · </span>
            )}
            {group.waitingCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">{group.waitingCount} รอ · </span>
            )}
            {group.openConvCount} สนทนาเปิดอยู่
          </p>
        </div>

        <div className="text-right flex-shrink-0 space-y-2">
          <EmployeeChips employees={group.assignedEmployees} />
          {group.lastActivityAt && (
            <p className="text-[10px] text-on-surface-variant">
              {formatDateTime(group.lastActivityAt)}
            </p>
          )}
          {group.conversations.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? 'ซ่อน' : 'สถานะ'}
            </button>
          )}
        </div>
      </div>

      {expanded && group.conversations.length > 0 && (
        <div className="border-t border-surface-container-high/30 px-5 pb-4 pt-3 space-y-2">
          {group.conversations.map((conv, idx) => (
            <ConversationRow
              key={conv._id}
              conv={conv}
              index={idx + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conv,
  index,
}: {
  conv: MonitorConversation;
  index: number;
}) {
  const rsCfg = RESPONSE_STATUS_CONFIG[conv.responseStatus];

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-surface-container">
      <span className="text-[10px] font-bold text-on-surface-variant w-4 flex-shrink-0">
        #{index}
      </span>
      <span className={cn('text-[10px] font-bold', rsCfg.cls)}>{rsCfg.label}</span>
      {conv.pendingMs > 0 && (
        <span className="text-[10px] text-on-surface-variant">รอ {formatMs(conv.pendingMs)}</span>
      )}
      {conv.lastCustomerMessageAt && (
        <span className="text-[10px] text-on-surface-variant hidden sm:inline">
          · {formatDateTime(conv.lastCustomerMessageAt)}
        </span>
      )}
    </div>
  );
}

function EmployeeChips({ employees }: { employees: MonitorEmployee[] }) {
  if (employees.length === 0) {
    return <span className="text-[10px] text-on-surface-variant">ไม่มีพนักงาน</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {employees.map((emp) => (
        <span
          key={emp._id}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold"
          title={`${emp.name} (${emp.employeeCode})`}
        >
          {emp.name.charAt(0)}
        </span>
      ))}
    </div>
  );
}
