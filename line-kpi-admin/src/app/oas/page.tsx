'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { oasApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { LineOa } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emptyForm = {
  channelId: '',
  channelSecret: '',
  channelAccessToken: '',
  displayName: '',
};

export default function OasPage() {
  const [oas, setOas] = useState<LineOa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LineOa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchOas = async () => {
    try {
      const data = await oasApi.list();
      setOas(data);
    } catch (err) {
      console.error('Failed to fetch LINE OAs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOas();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (oa: LineOa) => {
    setEditing(oa);
    setForm({
      channelId: oa.channelId,
      channelSecret: '',
      channelAccessToken: '',
      displayName: oa.displayName,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const body: Record<string, string | boolean> = {
          displayName: form.displayName,
        };
        if (form.channelSecret) body.channelSecret = form.channelSecret;
        if (form.channelAccessToken) body.channelAccessToken = form.channelAccessToken;
        await oasApi.update(editing._id, body);
      } else {
        await oasApi.create({
          channelId: form.channelId,
          channelSecret: form.channelSecret,
          channelAccessToken: form.channelAccessToken,
          displayName: form.displayName,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await fetchOas();
    } catch (err) {
      console.error('Failed to save LINE OA:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActiveChange = async (oa: LineOa, isActive: boolean) => {
    try {
      await oasApi.update(oa._id, { isActive });
      await fetchOas();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">LINE OA</h1>
        <Button size="sm" onClick={openCreate} className="bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
          <Plus className="h-4 w-4 mr-1" />
          เพิ่ม
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-surface-container-lowest border-surface-container-high rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-on-surface">
                {editing ? 'แก้ไข LINE OA' : 'เพิ่ม LINE OA'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อ OA</Label>
                <Input
                  id="displayName"
                  required
                  value={form.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  placeholder="ชื่อ LINE OA"
                  className="rounded-xl"
                />
              </div>

              {editing ? (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channel ID</Label>
                  <p className="text-sm text-on-surface-variant px-3 py-2 bg-surface-container-low rounded-xl border border-surface-container-high/30">
                    {editing.channelId}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="channelId" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channel ID</Label>
                  <Input
                    id="channelId"
                    required
                    value={form.channelId}
                    onChange={(e) => updateField('channelId', e.target.value)}
                    placeholder="Channel ID"
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="channelSecret" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channel Secret</Label>
                <Input
                  id="channelSecret"
                  type="password"
                  required={!editing}
                  value={form.channelSecret}
                  onChange={(e) => updateField('channelSecret', e.target.value)}
                  placeholder={editing ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'Channel Secret'}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channelAccessToken" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channel Access Token</Label>
                <Input
                  id="channelAccessToken"
                  type="password"
                  required={!editing}
                  value={form.channelAccessToken}
                  onChange={(e) => updateField('channelAccessToken', e.target.value)}
                  placeholder={editing ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'Channel Access Token'}
                  className="rounded-xl"
                />
              </div>

              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="isActive" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">สถานะ</Label>
                  <select
                    id="isActive"
                    value={editing.isActive ? 'true' : 'false'}
                    onChange={(e) => handleActiveChange(editing, e.target.value === 'true')}
                    className="w-full rounded-xl bg-surface-container-lowest border border-surface-container-high/30 px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="true">ใช้งาน</option>
                    <option value="false">ไม่ใช้งาน</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : oas.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-headline font-bold text-on-surface-variant">ยังไม่มี LINE OA</p>
          <p className="text-on-surface-variant mt-1">กด + เพื่อเพิ่ม</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อ OA</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Channel ID</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">วันที่เพิ่ม</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-[60px]">แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {oas.map((oa) => (
                <tr key={oa._id} className="border-b border-surface-container-low/50 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-4 py-3 text-on-surface font-medium">
                    {oa.displayName}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant font-mono text-sm">
                    {oa.channelId}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={oa.isActive} label={oa.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'} />
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {formatDate(oa.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(oa)}
                      className="p-2 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
