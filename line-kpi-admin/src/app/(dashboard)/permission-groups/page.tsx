'use client';

import { useEffect, useState, useCallback } from 'react';
import { permissionGroupsApi } from '@/lib/api';
import type { PermissionGroup, PermissionKey } from '@/types/api';
import { ALL_PERMISSION_KEYS, PERMISSION_LABELS } from '@/types/api';
import { Shield, Plus, Pencil, Trash2, X } from 'lucide-react';

// ─── modal: create / edit ────────────────────────────────────────────────────

interface GroupFormProps {
  group?: PermissionGroup;
  onClose: () => void;
  onSaved: () => void;
}

function GroupForm({ group, onClose, onSaved }: GroupFormProps) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [permissions, setPermissions] = useState<PermissionKey[]>(group?.permissions ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function togglePerm(key: PermissionKey) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function selectAll() { setPermissions([...ALL_PERMISSION_KEYS]); }
  function clearAll() { setPermissions([]); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await permissionGroupsApi.update(group._id, { name, description, permissions });
      } else {
        await permissionGroupsApi.create({ name, description, permissions });
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
            {isEdit ? 'แก้ไขกลุ่มสิทธิ์' : 'เพิ่มกลุ่มสิทธิ์'}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-on-surface-variant" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">ชื่อกลุ่ม</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="เช่น พนักงานขาย, ผู้จัดการ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">คำอธิบาย</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline/30 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="อธิบายบทบาทของกลุ่มนี้"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-on-surface">สิทธิ์การเข้าถึงเมนู</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">เลือกทั้งหมด</button>
                <span className="text-on-surface-variant">·</span>
                <button type="button" onClick={clearAll} className="text-xs text-on-surface-variant hover:underline">ล้าง</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-surface-container rounded-xl p-4">
              {ALL_PERMISSION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={permissions.includes(key)}
                    onChange={() => togglePerm(key)}
                    className="rounded border-outline/30 text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-on-surface">{PERMISSION_LABELS[key]}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              เลือก {permissions.length} / {ALL_PERMISSION_KEYS.length} สิทธิ์
            </p>
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
              disabled={loading || !name}
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

// ─── main page ───────────────────────────────────────────────────────────────

export default function PermissionGroupsPage() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGroup, setEditGroup] = useState<PermissionGroup | undefined>();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionGroupsApi.list();
      setGroups(data);
    } catch {/* noop */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  async function handleDelete(group: PermissionGroup) {
    if (!confirm(`ลบกลุ่ม "${group.name}" ใช่หรือไม่?`)) return;
    try {
      await permissionGroupsApi.delete(group._id);
      fetchGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditGroup(undefined);
    fetchGroups();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-headline font-bold text-xl text-on-surface">กลุ่มสิทธิ์</h1>
            <p className="text-sm text-on-surface-variant">กำหนดชุดสิทธิ์สำหรับแต่ละบทบาท</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          เพิ่มกลุ่ม
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">กำลังโหลด...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
          ยังไม่มีกลุ่มสิทธิ์
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-surface-container rounded-2xl p-5 border border-outline/10 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-on-surface">{group.name}</h3>
                  {group.description && (
                    <p className="text-sm text-on-surface-variant mt-0.5">{group.description}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => { setEditGroup(group); setShowForm(true); }}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    title="แก้ไข"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                    title="ลบ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Permission badges */}
              <div className="flex flex-wrap gap-1.5">
                {group.permissions.length === 0 ? (
                  <span className="text-xs text-on-surface-variant italic">ไม่มีสิทธิ์</span>
                ) : (
                  group.permissions.map((key) => (
                    <span
                      key={key}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                    >
                      {PERMISSION_LABELS[key]}
                    </span>
                  ))
                )}
              </div>

              <p className="text-[10px] text-on-surface-variant mt-2">
                {group.permissions.length} / {ALL_PERMISSION_KEYS.length} สิทธิ์
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <GroupForm
          group={editGroup}
          onClose={() => { setShowForm(false); setEditGroup(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
