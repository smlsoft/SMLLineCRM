'use client';

import { useEffect, useState } from 'react';
import { issueCategoriesApi } from '@/lib/api';
import type { IssueCategoryMaster } from '@/types/api';
import { Plus, Pencil, Check, X, Tag } from 'lucide-react';

export default function IssueCategoriesPage() {
  const [categories, setCategories] = useState<IssueCategoryMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = () => {
    setLoading(true);
    issueCategoriesApi
      .list()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-extrabold text-on-surface">ประเภทปัญหา</h1>
            <p className="text-xs text-on-surface-variant">Master categories ที่ AI ใช้ในการจัดหมวดหมู่</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 inline-flex items-center gap-1.5"
        >
          <Plus className="size-4" />
          เพิ่มประเภท
        </button>
      </div>

      {showAddForm && (
        <AddCategoryForm
          onSave={() => { setShowAddForm(false); load(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-on-surface-variant">ยังไม่มีประเภทปัญหา กดเพิ่มเพื่อสร้างใหม่</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) =>
            editingId === cat._id ? (
              <EditCategoryRow
                key={cat._id}
                category={cat}
                onSave={() => { setEditingId(null); load(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CategoryRow
                key={cat._id}
                category={cat}
                onEdit={() => setEditingId(cat._id)}
                onToggle={() => {
                  issueCategoriesApi
                    .update(cat._id, { isActive: !cat.isActive })
                    .then(load)
                    .catch(() => {});
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onToggle,
}: {
  category: IssueCategoryMaster;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 border transition-colors ${
      category.isActive
        ? 'bg-surface-container-lowest border-surface-container-high/30'
        : 'bg-surface-container/50 border-surface-container-high/20 opacity-60'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-on-surface">{category.name}</p>
          {!category.isActive && (
            <span className="text-[10px] bg-surface-container-high text-on-surface-variant rounded-full px-2 py-0.5 font-bold">
              ปิดใช้งาน
            </span>
          )}
        </div>
        {category.description && (
          <p className="text-xs text-on-surface-variant mt-0.5">{category.description}</p>
        )}
        {category.keywords && category.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {category.keywords.map((kw, i) => (
              <span key={i} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            category.isActive ? 'bg-primary' : 'bg-surface-container-high'
          }`}
          title={category.isActive ? 'คลิกเพื่อปิด' : 'คลิกเพื่อเปิด'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              category.isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
          title="แก้ไข"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditCategoryRow({
  category,
  onSave,
  onCancel,
}: {
  category: IssueCategoryMaster;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const [keywords, setKeywords] = useState((category.keywords ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await issueCategoriesApi.update(category._id, {
        name: name.trim(),
        description: description || undefined,
        keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
      });
      onSave();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl px-4 py-3 border border-primary/30 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อประเภทปัญหา *"
          className="flex-1 bg-surface-container border border-surface-container-high rounded-xl px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="p-1.5 rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-50"
          title="บันทึก"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"
          title="ยกเลิก"
        >
          <X className="size-4" />
        </button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="คำอธิบาย (optional)"
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
      />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="คำสำคัญ คั่นด้วย comma เช่น login, เข้าไม่ได้"
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
      />
    </div>
  );
}

function AddCategoryForm({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('กรุณาระบุชื่อประเภทปัญหา'); return; }
    setSaving(true);
    setError('');
    try {
      await issueCategoriesApi.create({
        name: name.trim(),
        description: description || undefined,
        keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
      });
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 border border-primary/30 space-y-3">
      <p className="text-sm font-bold text-on-surface">เพิ่มประเภทปัญหาใหม่</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อประเภทปัญหา *"
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="คำอธิบาย (optional)"
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
      />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="คำสำคัญ คั่นด้วย comma เช่น login, เข้าไม่ได้"
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}
