'use client';

import { useEffect, useState } from 'react';
import { employeesApi } from '@/lib/api';
import type { Employee } from '@/types/api';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_PASSWORD_LENGTH = 8;
const labelCls = 'text-[10px] font-bold text-on-surface-variant uppercase tracking-wider';

/**
 * Sets an employee's login for the AI assistant app: username, a new password (blank keeps the
 * current one) and whether login is allowed. The password is never shown back.
 */
export function AssistantLoginDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!employee) return;
    setUsername(employee.assistantUsername ?? employee.employeeCode.toLowerCase());
    setPassword('');
    setEnabled(!!employee.assistantLoginEnabled);
    setError('');
  }, [employee]);

  const hasPassword = !!employee?.assistantPasswordSetAt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setError('');
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (enabled && !hasPassword && !password) {
      setError('ต้องตั้งรหัสผ่านก่อนเปิดสิทธิ์');
      return;
    }
    setSaving(true);
    try {
      await employeesApi.setAssistantLogin(employee._id, {
        username: username.trim().toLowerCase(),
        ...(password ? { password } : {}),
        enabled,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface-container-lowest border-surface-container-high rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-on-surface">การเข้าแอปผู้ช่วย AI · {employee?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="assistantUsername" className={labelCls}>ชื่อผู้ใช้</Label>
            <Input
              id="assistantUsername"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="a-z 0-9 . _ - (3-32 ตัว)"
              autoComplete="off"
              className="rounded-xl font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistantPassword" className={labelCls}>
              {hasPassword ? 'รหัสผ่านใหม่ (เว้นว่างไว้ = ใช้รหัสเดิม)' : 'รหัสผ่าน'}
            </Label>
            <Input
              id="assistantPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
              autoComplete="new-password"
              className="rounded-xl"
            />
            <p className="text-[11px] text-on-surface-variant">
              {hasPassword && employee?.assistantPasswordSetAt
                ? `ตั้งรหัสล่าสุด ${formatDateTime(employee.assistantPasswordSetAt)}`
                : 'ยังไม่ได้ตั้งรหัสผ่าน'}
            </p>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 accent-primary"
            />
            อนุญาตให้เข้าแอปผู้ช่วย AI
          </label>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
