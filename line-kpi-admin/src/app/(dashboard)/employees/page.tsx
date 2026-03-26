'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { employeesApi } from '@/lib/api';
import { formatDate, maskLineId } from '@/lib/utils';
import type { Employee } from '@/types/api';
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
  lineUserId: '',
  name: '',
  employeeCode: '',
  department: '',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    try {
      const data = await employeesApi.list();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      lineUserId: emp.lineUserId,
      name: emp.name,
      employeeCode: emp.employeeCode,
      department: emp.department ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await employeesApi.update(editing._id, {
          name: form.name,
          employeeCode: form.employeeCode,
          department: form.department || undefined,
        });
      } else {
        await employeesApi.create({
          lineUserId: form.lineUserId,
          name: form.name,
          employeeCode: form.employeeCode,
          department: form.department || undefined,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await fetchEmployees();
    } catch (err) {
      console.error('Failed to save employee:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (emp: Employee) => {
    if (!window.confirm('ยืนยันปิดการใช้งาน?')) return;
    try {
      await employeesApi.deactivate(emp._id);
      await fetchEmployees();
    } catch (err) {
      console.error('Failed to deactivate employee:', err);
    }
  };

  const handleActiveChange = async (emp: Employee, isActive: boolean) => {
    try {
      await employeesApi.update(emp._id, { isActive });
      await fetchEmployees();
    } catch (err) {
      console.error('Failed to update employee status:', err);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">พนักงาน</h1>
        <Button size="sm" onClick={openCreate} className="bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
          <Plus className="h-4 w-4 mr-1" />
          เพิ่ม
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-surface-container-lowest border-surface-container-high rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-on-surface">
                {editing ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อ</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="ชื่อพนักงาน"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCode" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">รหัสพนักงาน</Label>
                <Input
                  id="employeeCode"
                  required
                  value={form.employeeCode}
                  onChange={(e) => updateField('employeeCode', e.target.value)}
                  placeholder="รหัสพนักงาน"
                  className="rounded-xl"
                />
              </div>

              {!editing && (
                <div className="space-y-2">
                  <Label htmlFor="lineUserId" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LINE User ID</Label>
                  <Input
                    id="lineUserId"
                    required
                    value={form.lineUserId}
                    onChange={(e) => updateField('lineUserId', e.target.value)}
                    placeholder="Uxxxxxxxxxx"
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="department" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">แผนก</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  placeholder="แผนก (ไม่บังคับ)"
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
      ) : employees.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-headline font-bold text-on-surface-variant">ยังไม่มีพนักงาน</p>
          <p className="text-on-surface-variant mt-1">กด + เพื่อเพิ่ม</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/30 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ชื่อ</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">รหัสพนักงาน</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">แผนก</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LINE User ID</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">วันที่เพิ่ม</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-[100px]">แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id} className="border-b border-surface-container-low/50 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-4 py-3 text-on-surface font-medium">
                    {emp.name}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant font-mono text-sm">
                    {emp.employeeCode}
                  </td>
                  <td className="px-4 py-3 text-on-surface/80">
                    {emp.department ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant font-mono text-sm">
                    {maskLineId(emp.lineUserId)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={emp.isActive} label={emp.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'} />
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {formatDate(emp.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-2 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {emp.isActive && (
                        <button
                          onClick={() => handleDeactivate(emp)}
                          className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      )}
                    </div>
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
