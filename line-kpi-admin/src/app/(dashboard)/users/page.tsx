'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminUsersApi, permissionGroupsApi } from '@/lib/api';
import type { AdminUser, PermissionGroup, PermissionKey } from '@/types/api';
import { ALL_PERMISSION_KEYS, PERMISSION_LABELS } from '@/types/api';
import { UserCog, Plus, Pencil, Trash2, KeyRound, ShieldCheck, X } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function groupName(user: AdminUser): string {
  if (!user.groupId) return '-';
  if (typeof user.groupId === 'object') return user.groupId.name;
  return user.groupId;
}

// ─── modal: create / edit ────────────────────────────────────────────────────

interface UserFormProps {
  user?: AdminUser;
  groups: PermissionGroup[];
  onClose: () => void;
  onSaved: () => void;
}

function UserForm({ user, groups, onClose, onSaved }: UserFormProps) {
  const isEdit = !!user;

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [groupId, setGroupId] = useState(() => {
    if (!user?.groupId) return '';
    if (typeof user.groupId === 'object') return user.groupId._id;
    return user.groupId;
  });
  const [additionalPermissions, setAdditionalPermissions] = useState<PermissionKey[]>(
    user?.additionalPermissions ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function togglePerm(key: PermissionKey) {
    setAdditionalPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await adminUsersApi.update(user._id, {
          displayName,
          groupId: groupId || null,
          additionalPermissions,
        });
      } else {
        if (!password) { setError('กรุณากรอกรหัสผ่าน'); setLoading(false); return; }
        await adminUsersApi.create({
          username,
          password,
          displayName,
          groupId: groupId || undefined,
          additionalPermissions,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline/10">
          <h2 className="font-headline font-bold text-lg text-on-surface">
            {isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isEdit}
              required={!isEdit}
              className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">ชื่อแสดง</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="ชื่อ-นามสกุล"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">กลุ่มสิทธิ์</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— ไม่มีกลุ่ม —</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              สิทธิ์เพิ่มเติม (เฉพาะตัว)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMISSION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={additionalPermissions.includes(key)}
                    onChange={() => togglePerm(key)}
                    className="rounded border-outline/30 text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-on-surface">{PERMISSION_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-error bg-error-container/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-outline/30 text-sm text-on-surface hover:bg-surface-container transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── modal: change password ──────────────────────────────────────────────────

function PasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminUsersApi.changePassword(user._id, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-outline/10">
          <h2 className="font-headline font-bold text-lg text-on-surface">เปลี่ยนรหัสผ่าน</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-on-surface-variant" /></button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <p className="text-sm text-on-surface mb-4">เปลี่ยนรหัสผ่านสำเร็จ</p>
              <button onClick={onClose} className="px-6 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">ปิด</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                รีเซ็ตรหัสผ่านสำหรับ <strong className="text-on-surface">{user.displayName}</strong>
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                required
                className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {error && <p className="text-sm text-error">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-outline/30 text-sm">ยกเลิก</button>
                <button type="submit" disabled={loading || newPassword.length < 6} className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50">
                  {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | undefined>();
  const [passwordUser, setPasswordUser] = useState<AdminUser | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, g] = await Promise.all([adminUsersApi.list(), permissionGroupsApi.list()]);
      setUsers(u);
      setGroups(g);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleToggleActive(user: AdminUser) {
    try {
      await adminUsersApi.update(user._id, { isActive: !user.isActive });
      fetchData();
    } catch {/* noop */}
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`ลบผู้ใช้ "${user.displayName}" ใช่หรือไม่?`)) return;
    try {
      await adminUsersApi.delete(user._id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditUser(undefined);
    fetchData();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-headline font-bold text-xl text-on-surface">ผู้ใช้งาน</h1>
            <p className="text-sm text-on-surface-variant">จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-2xl overflow-hidden border border-outline/10">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">ยังไม่มีผู้ใช้งาน</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline/10 bg-surface-container-high/50">
                <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">ชื่อผู้ใช้</th>
                <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">ชื่อแสดง</th>
                <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">กลุ่มสิทธิ์</th>
                <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">สถานะ</th>
                <th className="text-right px-4 py-3 font-semibold text-on-surface-variant">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-outline/10 last:border-0 hover:bg-surface-container-high/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-on-surface">{user.username}</span>
                      {user.isSuperAdmin && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Super
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-on-surface">{user.displayName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {groupName(user)}
                    {user.additionalPermissions.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        +{user.additionalPermissions.length}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => !user.isSuperAdmin && handleToggleActive(user)}
                      disabled={user.isSuperAdmin}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-surface-container-high text-on-surface-variant'
                      } ${user.isSuperAdmin ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
                    >
                      {user.isActive ? 'ใช้งาน' : 'ปิดการใช้'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPasswordUser(user)}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                        title="เปลี่ยนรหัสผ่าน"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditUser(user); setShowForm(true); }}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!user.isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <UserForm
          user={editUser}
          groups={groups}
          onClose={() => { setShowForm(false); setEditUser(undefined); }}
          onSaved={handleSaved}
        />
      )}
      {passwordUser && (
        <PasswordModal user={passwordUser} onClose={() => setPasswordUser(undefined)} />
      )}
    </div>
  );
}
