'use client';

import { useState, useEffect } from 'react';
import { groupsApi } from '@/lib/api';
import type { CustomerGroup } from '@/types/api';
import { formatDate, maskLineId } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil } from 'lucide-react';

interface GroupForm { name: string; lineGroupId: string; description: string; }
const emptyForm: GroupForm = { name: '', lineGroupId: '', description: '' };

export default function GroupsPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchGroups = () => {
    groupsApi.list().then(setGroups).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchGroups(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setIsActive(true); setDialogOpen(true); };
  const openEdit = (g: CustomerGroup) => {
    setEditing(g);
    setForm({ name: g.name, lineGroupId: g.lineGroupId, description: g.description ?? '' });
    setIsActive(g.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.lineGroupId.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await groupsApi.update(editing._id, { name: form.name.trim(), lineGroupId: form.lineGroupId.trim(), description: form.description.trim() || undefined, isActive });
      } else {
        await groupsApi.create({ name: form.name.trim(), lineGroupId: form.lineGroupId.trim(), description: form.description.trim() || undefined });
      }
      setDialogOpen(false);
      fetchGroups();
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">กลุ่มลูกค้า</h1>
        <button onClick={openCreate} className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" /> เพิ่มกลุ่ม
        </button>
      </div>

      <div className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(searchInput); }}
          placeholder="ค้นหาชื่อกลุ่ม..."
          className="rounded-xl max-w-xs"
        />
        <button
          onClick={() => setSearchQuery(searchInput)}
          className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
        >
          ค้นหา
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
          <p className="text-lg font-headline font-bold">ยังไม่มีกลุ่มลูกค้า</p>
          <p className="text-sm mt-1">กด + เพื่อเพิ่ม</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container-low">
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อกลุ่ม</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LINE Group ID</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">รายละเอียด</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">วันที่สร้าง</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-16">แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant">
                    ไม่พบกลุ่มที่ค้นหา
                  </td>
                </tr>
              ) : filteredGroups.map((g) => (
                <tr key={g._id} className="border-b border-surface-container-low/50 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-3 text-sm font-bold text-on-surface">{g.name}</td>
                  <td className="px-6 py-3 text-xs font-mono text-on-surface-variant">{maskLineId(g.lineGroupId)}</td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant max-w-xs truncate">{g.description || '—'}</td>
                  <td className="px-6 py-3"><StatusBadge isActive={g.isActive} /></td>
                  <td className="px-6 py-3 text-sm text-on-surface-variant">{formatDate(g.createdAt)}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(g)} className="p-2 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-surface-container-lowest border-surface-container-high sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-extrabold text-on-surface">
              {editing ? 'แก้ไขกลุ่มลูกค้า' : 'เพิ่มกลุ่มลูกค้า'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อกลุ่ม *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ทีมขาย" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LINE Group ID *</Label>
              <Input value={form.lineGroupId} onChange={(e) => setForm({ ...form, lineGroupId: e.target.value })} placeholder="C1234abc..." required className="rounded-xl font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">รายละเอียด</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)" className="rounded-xl" />
            </div>
            {editing && (
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">สถานะ</Label>
                <Select value={isActive ? 'active' : 'inactive'} onValueChange={(val) => setIsActive(val === 'active')}>
                  <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">ใช้งาน</SelectItem><SelectItem value="inactive">ไม่ใช้งาน</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
              <button type="submit" disabled={submitting || !form.name.trim() || !form.lineGroupId.trim()} className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
                {submitting ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'เพิ่มกลุ่ม'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
