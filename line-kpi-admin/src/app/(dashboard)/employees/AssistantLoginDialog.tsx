'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
  const [removing, setRemoving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // The saved password once revealed; saving the same value again does not reset it.
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealNote, setRevealNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!employee) {
      // Closed: forget any revealed or typed password right away.
      setPassword('');
      setSavedPassword(null);
      setShowPassword(false);
      setRevealNote('');
      return;
    }
    setUsername(employee.assistantUsername ?? employee.employeeCode.toLowerCase());
    setPassword('');
    setEnabled(!!employee.assistantLoginEnabled);
    setError('');
    setShowPassword(false);
    setSavedPassword(null);
    setRevealNote('');
  }, [employee]);

  const hasPassword = !!employee?.assistantPasswordSetAt;
  const hasLogin = !!employee?.assistantUsername || hasPassword;

  // Eye button: shows what is typed; for a saved password with nothing typed, fetches and shows it.
  const toggleShow = async () => {
    if (showPassword) { setShowPassword(false); return; }
    setShowPassword(true);
    if (!employee || !hasPassword || password || savedPassword !== null) return;
    setRevealing(true);
    setRevealNote('');
    try {
      const res = await employeesApi.getAssistantPassword(employee._id);
      setSavedPassword(res.password);
      setPassword(res.password);
    } catch (err) {
      setRevealNote(err instanceof Error ? err.message : 'ดูรหัสผ่านไม่สำเร็จ');
    } finally {
      setRevealing(false);
    }
  };

  const handleRemove = async () => {
    if (!employee) return;
    if (!window.confirm(`ลบชื่อผู้ใช้และรหัสผ่านแอปผู้ช่วยของ ${employee.name}?\nพนักงานคนนี้จะเข้าแอปผู้ช่วยไม่ได้จนกว่าจะตั้งใหม่`)) return;
    setError('');
    setRemoving(true);
    try {
      await employeesApi.removeAssistantLogin(employee._id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setRemoving(false);
    }
  };

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
        ...(password && password !== savedPassword ? { password } : {}),
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
              {hasPassword ? 'รหัสผ่าน (เว้นว่างไว้ = ใช้รหัสเดิม · กดรูปตาเพื่อดูรหัสที่ตั้งไว้)' : 'รหัสผ่าน'}
            </Label>
            <div className="relative">
              <Input
                id="assistantPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? '••••••••' : `อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
                autoComplete="new-password"
                className="rounded-xl pr-10 font-mono"
              />
              <button
                type="button"
                onClick={toggleShow}
                disabled={revealing}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant hover:text-primary disabled:opacity-50"
              >
                {revealing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {revealNote && <p className="text-[11px] text-amber-600 dark:text-amber-400">{revealNote}</p>}
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

          <div className="flex items-center justify-end gap-2 pt-2">
            {hasLogin && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                disabled={saving || removing}
                className="mr-auto rounded-xl text-error hover:bg-error/10 transition-colors"
              >
                {removing ? 'กำลังลบ...' : 'ลบชื่อผู้ใช้/รหัสผ่าน'}
              </Button>
            )}
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
              disabled={saving || removing}
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
