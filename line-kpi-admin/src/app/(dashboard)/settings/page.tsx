'use client';

import { useState, useEffect, useCallback } from 'react';
import { configApi } from '@/lib/api';
import type { SystemConfig, AiTaskName, AiProviderGroup, AiProviderInGroup, AiModelOption, MediaStorageConfig } from '@/types/api';
import { KNOWN_PROVIDERS, KNOWN_PROVIDERS_MAP } from '@/lib/knownProviders';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Save, Zap, CheckCircle2, XCircle, Loader2,
  ChevronDown, Eye, EyeOff, X, GripVertical, HardDrive,
} from 'lucide-react';

const MASK = '••••••';

const TASK_LABELS: Record<AiTaskName, { th: string; desc: string }> = {
  issueAnalysis: { th: 'วิเคราะห์ปัญหาลูกค้า', desc: 'จัดหมวดหมู่บทสนทนาแต่ละรายการด้วย AI' },
};

const TASK_NAMES: AiTaskName[] = ['issueAnalysis'];

function nanoid(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

// ============================================================
//  Main Page
// ============================================================
export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(() => {
    setLoading(true);
    configApi
      .get()
      .then((cfg) => setConfig(cfg))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-surface-container rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">ตั้งค่าระบบ</h1>
        <p className="text-xs text-on-surface-variant mt-1">จัดการกลุ่ม AI Provider, routing และ Cron Jobs</p>
      </div>

      <MediaStorageSection config={config} onConfigUpdate={setConfig} />
      <ProviderGroupsSection config={config} onConfigUpdate={setConfig} />
      <TaskRoutingSection config={config} onConfigUpdate={setConfig} />
      <CronJobsSection config={config} onConfigUpdate={setConfig} />
    </div>
  );
}

// ============================================================
//  Section 1: Provider Groups
// ============================================================
function ProviderGroupsSection({
  config,
  onConfigUpdate,
}: {
  config: SystemConfig | null;
  onConfigUpdate: (cfg: SystemConfig) => void;
}) {
  const [groups, setGroups] = useState<Record<string, AiProviderGroup>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (config?.ai?.providerGroups) {
      // Deep clone
      setGroups(JSON.parse(JSON.stringify(config.ai.providerGroups)));
    }
  }, [config]);

  const addGroup = () => {
    const groupId = `grp_${nanoid()}`;
    setGroups((prev) => ({
      ...prev,
      [groupId]: { name: 'กลุ่มใหม่', providers: [] },
    }));
  };

  const deleteGroup = (groupId: string) => {
    setGroups((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const updateGroup = (groupId: string, updated: AiProviderGroup) => {
    setGroups((prev) => ({ ...prev, [groupId]: updated }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Find deleted groups (in config but not in local draft)
      const existing = config?.ai?.providerGroups ?? {};
      const deleted: Record<string, null> = {};
      for (const key of Object.keys(existing)) {
        if (!groups[key]) deleted[key] = null;
      }

      const updated = await configApi.update({
        ai: { providerGroups: { ...groups, ...deleted } },
      });
      onConfigUpdate(updated);
      setSaveMsg('บันทึกสำเร็จ');
    } catch {
      setSaveMsg('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // Find which groupIds are referenced by tasks (to disable delete)
  const usedGroupIds = new Set(
    Object.values(config?.ai?.tasks ?? {}).map((t) => t.groupId)
  );

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-headline font-bold text-on-surface">Provider Groups</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            สร้างกลุ่ม Provider — ถ้าตัวแรกหมด limit ระบบจะข้ามไปตัวถัดไปอัตโนมัติ
          </p>
        </div>
        <button
          onClick={addGroup}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-primary text-on-primary px-3 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          กลุ่มใหม่
        </button>
      </div>

      {Object.keys(groups).length === 0 && (
        <p className="text-sm text-on-surface-variant text-center py-8">
          ยังไม่มีกลุ่ม Provider — กด &quot;กลุ่มใหม่&quot; เพื่อเริ่มต้น
        </p>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([groupId, group]) => (
          <ProviderGroupCard
            key={groupId}
            groupId={groupId}
            group={group}
            isUsed={usedGroupIds.has(groupId)}
            onChange={(updated) => updateGroup(groupId, updated)}
            onDelete={() => deleteGroup(groupId)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          บันทึกกลุ่ม Provider
        </button>
        {saveMsg && (
          <span className={cn('text-xs font-bold', saveMsg.includes('สำเร็จ') ? 'text-emerald-600' : 'text-red-600')}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Provider Group Card
// ============================================================
function ProviderGroupCard({
  groupId,
  group,
  isUsed,
  onChange,
  onDelete,
}: {
  groupId: string;
  group: AiProviderGroup;
  isUsed: boolean;
  onChange: (g: AiProviderGroup) => void;
  onDelete: () => void;
}) {
  const addProvider = () => {
    onChange({
      ...group,
      providers: [
        ...group.providers,
        {
          providerKey: 'openrouter',
          apiKey: '',
          baseUrl: KNOWN_PROVIDERS_MAP['openrouter']?.defaultBaseUrl ?? '',
          models: [],
          enabled: true,
        },
      ],
    });
  };

  const updateProvider = (idx: number, p: AiProviderInGroup) => {
    const next = [...group.providers];
    next[idx] = p;
    onChange({ ...group, providers: next });
  };

  const removeProvider = (idx: number) => {
    const next = group.providers.filter((_, i) => i !== idx);
    onChange({ ...group, providers: next });
  };

  return (
    <div className="bg-surface-container rounded-2xl p-4 space-y-4 border border-surface-container-high/30">
      {/* Group header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">ชื่อกลุ่ม</label>
          <input
            type="text"
            value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })}
            className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex-shrink-0 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-0 select-none">X</label>
          <button
            onClick={onDelete}
            disabled={isUsed}
            title={isUsed ? 'กลุ่มนี้ถูกใช้โดย Task Routing — ต้องเปลี่ยน task routing ก่อน' : 'ลบกลุ่ม'}
            className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3.5" />
            ลบกลุ่ม
          </button>
        </div>
      </div>

      <div className="text-[10px] text-on-surface-variant font-mono">
        ID: <span className="text-primary">{groupId}</span>
      </div>

      {/* Provider entries */}
      <div className="space-y-3">
        {group.providers.map((provider, idx) => (
          <ProviderEntryRow
            key={idx}
            index={idx}
            total={group.providers.length}
            provider={provider}
            onChange={(updated) => updateProvider(idx, updated)}
            onRemove={() => removeProvider(idx)}
            onMoveUp={() => {
              if (idx === 0) return;
              const next = [...group.providers];
              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
              onChange({ ...group, providers: next });
            }}
            onMoveDown={() => {
              if (idx === group.providers.length - 1) return;
              const next = [...group.providers];
              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
              onChange({ ...group, providers: next });
            }}
          />
        ))}
      </div>

      <button
        onClick={addProvider}
        className="inline-flex items-center gap-1.5 bg-surface-container-lowest border border-dashed border-surface-container-high text-on-surface-variant px-4 py-2 rounded-xl text-sm font-bold hover:text-on-surface hover:border-primary/40 transition-colors w-full justify-center"
      >
        <Plus className="size-4" />
        เพิ่ม Provider
      </button>
    </div>
  );
}

// ============================================================
//  Provider Entry Row
// ============================================================
function ProviderEntryRow({
  index,
  total,
  provider,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  provider: AiProviderInGroup;
  onChange: (p: AiProviderInGroup) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelOptions, setModelOptions] = useState<AiModelOption[]>([]);
  const [fetchError, setFetchError] = useState('');

  const knownDef = KNOWN_PROVIDERS_MAP[provider.providerKey];
  const canFetchModels = knownDef?.modelsPath !== null;

  const handleProviderChange = (key: string) => {
    const def = KNOWN_PROVIDERS_MAP[key];
    onChange({
      ...provider,
      providerKey: key,
      baseUrl: def?.defaultBaseUrl ?? '',
      // Don't clear apiKey/models when switching
    });
    setModelOptions([]);
    setFetchError('');
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchError('');
    try {
      const result = await configApi.listModels(provider.providerKey, provider.apiKey || undefined);
      if (result.error) {
        setFetchError(result.error);
      } else {
        setModelOptions(result.models);
        if (result.note) setFetchError(result.note);
      }
    } catch {
      setFetchError('ไม่สามารถดึง model list ได้');
    } finally {
      setFetchingModels(false);
    }
  };

  const addModel = (model: string) => {
    if (!model || provider.models.includes(model)) return;
    onChange({ ...provider, models: [...provider.models, model] });
  };

  const removeModel = (model: string) => {
    onChange({ ...provider, models: provider.models.filter((m) => m !== model) });
  };

  return (
    <div className="bg-surface-container-high/20 border border-surface-container-high/40 rounded-xl p-3 space-y-3">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
            title="เลื่อนขึ้น (priority สูงขึ้น)"
          >
            <GripVertical className="size-3.5" />
          </button>
        </div>
        <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-lg">
          #{index + 1}
        </span>
        <div className="flex gap-1 ml-auto items-center">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-[10px] text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed border border-surface-container-high rounded-lg px-2 py-0.5"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-[10px] text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed border border-surface-container-high rounded-lg px-2 py-0.5"
          >
            ↓
          </button>
          {/* Enabled toggle */}
          <button
            onClick={() => onChange({ ...provider, enabled: !provider.enabled })}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              provider.enabled ? 'bg-primary' : 'bg-surface-container-high'
            )}
            role="switch"
            aria-checked={provider.enabled}
            title={provider.enabled ? 'เปิดใช้งาน (คลิกเพื่อปิด)' : 'ปิดใช้งาน (คลิกเพื่อเปิด)'}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', provider.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
          </button>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-600 transition-colors"
            title="ลบ provider นี้"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Provider type + API key */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Provider</label>
          <select
            value={provider.providerKey}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {KNOWN_PROVIDERS.map((p) => (
              <option key={p.key} value={p.key}>{p.displayName}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">API Key</label>
          <ApiKeyInput
            value={provider.apiKey}
            onChange={(v) => onChange({ ...provider, apiKey: v })}
            hasStored={!!provider.apiKey && provider.apiKey !== ''}
          />
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Base URL (ว่าง = ใช้ค่า default)</label>
        <input
          type="text"
          value={provider.baseUrl}
          onChange={(e) => onChange({ ...provider, baseUrl: e.target.value })}
          placeholder={knownDef?.defaultBaseUrl ?? 'https://...'}
          className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Models */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex-1">
            Models (เรียงตาม priority — ลองตัวแรกก่อน)
          </label>
          {canFetchModels && (
            <button
              onClick={handleFetchModels}
              disabled={fetchingModels}
              className="inline-flex items-center gap-1 text-[10px] font-bold bg-surface-container border border-surface-container-high text-on-surface-variant hover:text-on-surface px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {fetchingModels ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3" />}
              ดึง Models
            </button>
          )}
        </div>

        {fetchError && <p className="text-[10px] text-amber-600 dark:text-amber-400">{fetchError}</p>}

        <ModelChipList
          models={provider.models}
          modelOptions={modelOptions}
          onAdd={addModel}
          onRemove={removeModel}
        />
      </div>
    </div>
  );
}

// ============================================================
//  Model Chip List
// ============================================================
function ModelChipList({
  models,
  modelOptions,
  onAdd,
  onRemove,
}: {
  models: string[];
  modelOptions: AiModelOption[];
  onAdd: (model: string) => void;
  onRemove: (model: string) => void;
}) {
  const [newModel, setNewModel] = useState('');

  const handleAdd = () => {
    const val = newModel.trim();
    if (!val) return;
    onAdd(val);
    setNewModel('');
  };

  return (
    <div className="space-y-2">
      {/* Existing chips */}
      {models.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {models.map((m, i) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold"
            >
              <span className="text-primary/50 mr-0.5">#{i + 1}</span>
              {m}
              <button onClick={() => onRemove(m)} className="text-primary/60 hover:text-primary transition-colors ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add model */}
      <div className="flex gap-2">
        {modelOptions.length > 0 ? (
          <select
            value=""
            onChange={(e) => { if (e.target.value) { onAdd(e.target.value); } }}
            className="flex-1 bg-surface-container border border-surface-container-high rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— เลือก model จากรายการ —</option>
            {modelOptions
              .filter((m) => !models.includes(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                </option>
              ))}
          </select>
        ) : (
          <input
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="พิมพ์ model name แล้วกด Enter หรือ +"
            className="flex-1 bg-surface-container border border-surface-container-high rounded-xl px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        )}
        {modelOptions.length === 0 && (
          <button
            onClick={handleAdd}
            disabled={!newModel.trim()}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Section 2: Task Routing
// ============================================================
function TaskRoutingSection({
  config,
  onConfigUpdate,
}: {
  config: SystemConfig | null;
  onConfigUpdate: (cfg: SystemConfig) => void;
}) {
  type TaskMap = Record<AiTaskName, { groupId: string }>;
  const [tasks, setTasks] = useState<TaskMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; provider?: string; model?: string; error?: string } | null>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    // Only initialize from config when there are no unsaved local changes
    if (config?.ai?.tasks && !dirty) {
      setTasks(JSON.parse(JSON.stringify(config.ai.tasks)));
    }
  }, [config, dirty]);

  const groupOptions = Object.entries(config?.ai?.providerGroups ?? {}).map(([id, g]) => ({
    id,
    name: g.name,
  }));

  const handleSave = async () => {
    if (!tasks) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await configApi.update({ ai: { tasks } });
      setDirty(false);
      onConfigUpdate(updated);
      setSaveMsg('บันทึกสำเร็จ');
    } catch {
      setSaveMsg('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleTest = async (task: AiTaskName) => {
    setTesting(task);
    setTestResults((prev) => ({ ...prev, [task]: null }));
    try {
      const result = await configApi.testAi(task);
      setTestResults((prev) => ({ ...prev, [task]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [task]: { success: false, error: err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ' },
      }));
    } finally {
      setTesting(null);
    }
  };

  if (!tasks) return null;

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-5">
      <div>
        <h2 className="font-headline font-bold text-on-surface">Task Routing</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">กำหนดว่าแต่ละ task จะใช้กลุ่ม Provider ไหน</p>
      </div>

      {groupOptions.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠ ยังไม่มีกลุ่ม Provider — กรุณาสร้างกลุ่มในส่วน &quot;Provider Groups&quot; ก่อน
        </p>
      )}

      <div className="space-y-2">
        {TASK_NAMES.map((task) => {
          const currentGroupId = tasks[task]?.groupId ?? '';
          const testResult = testResults[task];
          return (
            <div key={task} className="bg-surface-container rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-bold text-on-surface">{TASK_LABELS[task].th}</p>
                  <p className="text-[10px] text-on-surface-variant">{TASK_LABELS[task].desc}</p>
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Provider Group</label>
                  <select
                    value={currentGroupId}
                    onChange={(e) => {
                      setTasks((prev) => prev ? ({ ...prev, [task]: { groupId: e.target.value } }) : prev);
                      setDirty(true);
                    }}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— เลือกกลุ่ม —</option>
                    {groupOptions.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-shrink-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-0 select-none block">X</label>
                  <button
                    onClick={() => handleTest(task)}
                    disabled={testing !== null || !currentGroupId}
                    className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-3 py-2 rounded-xl text-xs font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    {testing === task ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                    ทดสอบ
                  </button>
                </div>
              </div>
              {testResult && (
                <div className={cn(
                  'flex items-start gap-2 text-xs px-3 py-2 rounded-xl',
                  testResult.success
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-500/10 text-red-700 dark:text-red-400'
                )}>
                  {testResult.success
                    ? <CheckCircle2 className="size-3.5 flex-shrink-0 mt-0.5" />
                    : <XCircle className="size-3.5 flex-shrink-0 mt-0.5" />}
                  <span>
                    {testResult.success
                      ? `เชื่อมต่อสำเร็จ · ${testResult.provider} / ${testResult.model}`
                      : `ไม่สำเร็จ: ${testResult.error}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          บันทึก Task Routing
        </button>
        {saveMsg && (
          <span className={cn('text-xs font-bold', saveMsg.includes('สำเร็จ') ? 'text-emerald-600' : 'text-red-600')}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Section 3: Cron Jobs
// ============================================================
function CronJobsSection({
  config,
  onConfigUpdate,
}: {
  config: SystemConfig | null;
  onConfigUpdate: (cfg: SystemConfig) => void;
}) {
  const handleToggle = async (enabled: boolean) => {
    if (!config) return;
    const updated = await configApi.update({ jobs: { dailyAnalysis: { enabled } } }).catch(() => null);
    if (updated) onConfigUpdate(updated);
  };

  if (!config) return null;

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-4">
      <div>
        <h2 className="font-headline font-bold text-on-surface">Cron Jobs</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">การเปลี่ยนแปลงมีผลทันที (ไม่ต้อง restart)</p>
      </div>

      <div className="space-y-1">
        <JobToggle
          label="วิเคราะห์บทสนทนารายวัน"
          schedule="ทุกวัน 23:00"
          enabled={config.jobs.dailyAnalysis.enabled}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}

// ============================================================
//  Section 4: Media Storage
// ============================================================

const EMPTY_R2 = { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' };
const EMPTY_S3 = { region: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' };

function MediaStorageSection({
  config,
  onConfigUpdate,
}: {
  config: SystemConfig | null;
  onConfigUpdate: (cfg: SystemConfig) => void;
}) {
  const [media, setMedia] = useState<MediaStorageConfig>({
    storage: 'none',
    r2: { ...EMPTY_R2 },
    s3: { ...EMPTY_S3 },
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (config?.media) {
      setMedia({
        storage: config.media.storage ?? 'none',
        r2: { ...EMPTY_R2, ...config.media.r2 },
        s3: { ...EMPTY_S3, ...config.media.s3 },
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setTestResult(null);
    try {
      const updated = await configApi.update({ media });
      onConfigUpdate(updated);
      setSaveMsg('บันทึกแล้ว');
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await configApi.testMedia();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: 'เกิดข้อผิดพลาด' });
    } finally {
      setTesting(false);
    }
  };

  const updateR2 = (field: string, value: string) =>
    setMedia((m) => ({ ...m, r2: { ...m.r2, [field]: value } }));

  const updateS3 = (field: string, value: string) =>
    setMedia((m) => ({ ...m, s3: { ...m.s3, [field]: value } }));

  return (
    <div className="bg-surface-container rounded-3xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-primary" />
        <h2 className="text-sm font-bold text-on-surface">การเก็บรูปภาพจาก LINE</h2>
      </div>

      {/* Storage selector */}
      <div className="space-y-2">
        {(['none', 'r2', 's3'] as const).map((opt) => (
          <label key={opt} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors">
            <input
              type="radio"
              name="media-storage"
              value={opt}
              checked={media.storage === opt}
              onChange={() => setMedia((m) => ({ ...m, storage: opt }))}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-bold text-on-surface">
                {opt === 'none' ? 'ไม่เก็บรูป' : opt === 'r2' ? 'Cloudflare R2' : 'AWS S3'}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {opt === 'none'
                  ? 'บันทึกเฉพาะว่ามีรูปส่งมา ไม่ดาวน์โหลด binary — ประหยัด storage มากที่สุด'
                  : opt === 'r2'
                    ? 'Cloudflare R2 — ไม่มีค่า egress, S3-compatible, 10 GB ฟรี/เดือน'
                    : 'AWS S3 — $0.023/GB/เดือน'}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* R2 config */}
      {media.storage === 'r2' && (
        <div className="space-y-3 pt-1">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Cloudflare R2 Credentials</p>
          {[
            { label: 'Account ID', field: 'accountId', placeholder: 'abc123def456...' },
            { label: 'Access Key ID', field: 'accessKeyId', placeholder: 'R2 Access Key ID' },
            { label: 'Secret Access Key', field: 'secretAccessKey', placeholder: MASK, isSecret: true },
            { label: 'Bucket Name', field: 'bucketName', placeholder: 'my-media-bucket' },
            { label: 'Public URL', field: 'publicUrl', placeholder: 'https://pub-xxx.r2.dev' },
          ].map(({ label, field, placeholder, isSecret }) => (
            <div key={field} className="space-y-1">
              <label className="text-[11px] text-on-surface-variant">{label}</label>
              {isSecret ? (
                <ApiKeyInput
                  value={media.r2[field as keyof typeof media.r2]}
                  onChange={(v) => updateR2(field, v)}
                  hasStored={!!config?.media?.r2?.secretAccessKey}
                />
              ) : (
                <input
                  type="text"
                  value={media.r2[field as keyof typeof media.r2]}
                  onChange={(e) => updateR2(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* S3 config */}
      {media.storage === 's3' && (
        <div className="space-y-3 pt-1">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">AWS S3 Credentials</p>
          {[
            { label: 'Region', field: 'region', placeholder: 'ap-southeast-1' },
            { label: 'Access Key ID', field: 'accessKeyId', placeholder: 'AKIA...' },
            { label: 'Secret Access Key', field: 'secretAccessKey', placeholder: MASK, isSecret: true },
            { label: 'Bucket Name', field: 'bucketName', placeholder: 'my-media-bucket' },
            { label: 'Public URL', field: 'publicUrl', placeholder: 'https://my-bucket.s3.amazonaws.com' },
          ].map(({ label, field, placeholder, isSecret }) => (
            <div key={field} className="space-y-1">
              <label className="text-[11px] text-on-surface-variant">{label}</label>
              {isSecret ? (
                <ApiKeyInput
                  value={media.s3[field as keyof typeof media.s3]}
                  onChange={(v) => updateS3(field, v)}
                  hasStored={!!config?.media?.s3?.secretAccessKey}
                />
              ) : (
                <input
                  type="text"
                  value={media.s3[field as keyof typeof media.s3]}
                  onChange={(e) => updateS3(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={cn('flex items-center gap-2 text-sm rounded-xl px-3 py-2', testResult.success ? 'bg-green-500/10 text-green-700' : 'bg-error/10 text-error')}>
          {testResult.success
            ? <><CheckCircle2 className="size-4 shrink-0" />เชื่อมต่อสำเร็จ</>
            : <><XCircle className="size-4 shrink-0" />{testResult.error}</>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary text-on-primary text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          บันทึก
        </button>
        {media.storage !== 'none' && (
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex items-center gap-1.5 border border-surface-container-high text-on-surface text-sm font-bold px-4 py-2 rounded-xl hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            ทดสอบการเชื่อมต่อ
          </button>
        )}
        {saveMsg && (
          <span className={cn('text-sm', saveMsg === 'บันทึกแล้ว' ? 'text-green-600' : 'text-error')}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Shared Components
// ============================================================

function ApiKeyInput({
  value,
  onChange,
  hasStored,
}: {
  value: string;
  onChange: (v: string) => void;
  hasStored: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const isMasked = value === MASK;

  return (
    <div className="relative">
      <input
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasStored && !isMasked ? '(ไม่เปลี่ยน)' : 'sk-...'}
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-3 py-2 text-sm text-on-surface font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 pr-9"
      />
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}

function JobToggle({
  label, schedule, enabled, onToggle,
}: {
  label: string; schedule: string; enabled: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-container-high/30 last:border-0">
      <div>
        <p className="text-sm font-bold text-on-surface">{label}</p>
        <p className="text-[10px] text-on-surface-variant">{schedule}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none', enabled ? 'bg-primary' : 'bg-surface-container-high')}
        role="switch" aria-checked={enabled}
      >
        <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
