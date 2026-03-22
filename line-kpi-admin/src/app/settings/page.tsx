'use client';

import { useState, useEffect, useCallback } from 'react';
import { configApi } from '@/lib/api';
import type { SystemConfig } from '@/types/api';
import { cn } from '@/lib/utils';
import { Save, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const MASK = '••••••';

type TestResult = { success: boolean; provider?: string; model?: string; response?: string; error?: string } | null;

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Local form state for AI section
  const [provider, setProvider] = useState<'openrouter' | 'kilo'>('openrouter');
  const [orKey, setOrKey] = useState('');
  const [orModel, setOrModel] = useState('');
  const [orBaseUrl, setOrBaseUrl] = useState('');
  const [kiloKey, setKiloKey] = useState('');
  const [kiloModel, setKiloModel] = useState('');
  const [kiloBaseUrl, setKiloBaseUrl] = useState('');

  const loadConfig = useCallback(() => {
    setLoading(true);
    configApi
      .get()
      .then((cfg) => {
        setConfig(cfg);
        setProvider(cfg.ai.provider);
        // Don't pre-fill masked keys — show empty so user knows to type new key
        setOrKey(cfg.ai.openrouter.apiKey === MASK ? '' : cfg.ai.openrouter.apiKey);
        setOrModel(cfg.ai.openrouter.model);
        setOrBaseUrl(cfg.ai.openrouter.baseUrl);
        setKiloKey(cfg.ai.kilo.apiKey === MASK ? '' : cfg.ai.kilo.apiKey);
        setKiloModel(cfg.ai.kilo.model);
        setKiloBaseUrl(cfg.ai.kilo.baseUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveAi = async () => {
    setSaving(true);
    setSaveMsg('');
    setTestResult(null);
    try {
      await configApi.update({
        ai: {
          provider,
          openrouter: {
            apiKey: orKey || MASK, // send MASK if empty = no change
            model: orModel,
            baseUrl: orBaseUrl,
          },
          kilo: {
            apiKey: kiloKey || MASK,
            model: kiloModel,
            baseUrl: kiloBaseUrl,
          },
        },
      });
      setSaveMsg('บันทึกสำเร็จ');
      loadConfig();
    } catch {
      setSaveMsg('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleToggleJob = async (job: 'dailyEvaluation' | 'issueAnalysis', enabled: boolean) => {
    if (!config) return;
    const updated = await configApi.update({ jobs: { [job]: { enabled } } }).catch(() => null);
    if (updated) setConfig(updated);
  };

  const handleTestAi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await configApi.testAi();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: 'ไม่สามารถเชื่อมต่อได้' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 bg-surface-container rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-headline font-extrabold text-on-surface">ตั้งค่าระบบ</h1>
        <p className="text-xs text-on-surface-variant mt-1">จัดการ AI provider และ Cron Jobs</p>
      </div>

      {/* Card 1: AI Provider */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-5">
        <h2 className="font-headline font-bold text-on-surface">AI Provider</h2>

        {/* Provider selector */}
        <div className="flex gap-3">
          {(['openrouter', 'kilo'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all',
                provider === p
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container border-surface-container-high text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              {p === 'openrouter' ? 'OpenRouter' : 'Kilo'}
            </button>
          ))}
        </div>

        {/* OpenRouter fields */}
        {provider === 'openrouter' && (
          <div className="space-y-3">
            <FormField
              label="API Key"
              type="password"
              value={orKey}
              onChange={setOrKey}
              placeholder="เว้นว่างถ้าไม่ต้องการเปลี่ยน"
              hint="ค่าเดิมถูกซ่อนไว้เพื่อความปลอดภัย"
            />
            <FormField label="Model" value={orModel} onChange={setOrModel} placeholder="anthropic/claude-3-haiku" />
            <FormField label="Base URL" value={orBaseUrl} onChange={setOrBaseUrl} placeholder="https://openrouter.ai/api/v1" />
          </div>
        )}

        {/* Kilo fields */}
        {provider === 'kilo' && (
          <div className="space-y-3">
            <FormField
              label="API Key"
              type="password"
              value={kiloKey}
              onChange={setKiloKey}
              placeholder="เว้นว่างถ้าไม่ต้องการเปลี่ยน"
              hint="ค่าเดิมถูกซ่อนไว้เพื่อความปลอดภัย"
            />
            <FormField label="Model" value={kiloModel} onChange={setKiloModel} placeholder="model name" />
            <FormField label="Base URL" value={kiloBaseUrl} onChange={setKiloBaseUrl} placeholder="https://..." />
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              'flex items-start gap-2 text-sm px-4 py-3 rounded-xl',
              testResult.success
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-700 dark:text-red-400'
            )}
          >
            {testResult.success ? <CheckCircle2 className="size-4 flex-shrink-0 mt-0.5" /> : <XCircle className="size-4 flex-shrink-0 mt-0.5" />}
            <span>
              {testResult.success
                ? `เชื่อมต่อสำเร็จ · ${testResult.provider} / ${testResult.model}`
                : `เชื่อมต่อไม่สำเร็จ: ${testResult.error}`}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestAi}
            disabled={testing}
            className="inline-flex items-center gap-1.5 bg-surface-container border border-surface-container-high text-on-surface px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            ทดสอบการเชื่อมต่อ
          </button>

          <button
            onClick={handleSaveAi}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            บันทึก
          </button>

          {saveMsg && (
            <span className={cn('text-xs font-bold', saveMsg.includes('สำเร็จ') ? 'text-emerald-600' : 'text-red-600')}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Cron Jobs */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high/30 shadow-sm space-y-4">
        <h2 className="font-headline font-bold text-on-surface">Cron Jobs</h2>
        <p className="text-xs text-on-surface-variant">การเปลี่ยนแปลงมีผลทันที (ไม่ต้อง restart)</p>

        {config && (
          <div className="space-y-3">
            <JobToggle
              label="ประเมิน KPI รายวัน"
              schedule="ทุกวัน 23:00"
              enabled={config.jobs.dailyEvaluation.enabled}
              onToggle={(v) => handleToggleJob('dailyEvaluation', v)}
            />
            <JobToggle
              label="วิเคราะห์ปัญหาลูกค้า"
              schedule="ทุกวัน 23:30"
              enabled={config.jobs.issueAnalysis.enabled}
              onToggle={(v) => handleToggleJob('issueAnalysis', v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container border border-surface-container-high rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {hint && <p className="text-[10px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}

function JobToggle({
  label, schedule, enabled, onToggle,
}: {
  label: string;
  schedule: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-container-high/30 last:border-0">
      <div>
        <p className="text-sm font-bold text-on-surface">{label}</p>
        <p className="text-[10px] text-on-surface-variant">{schedule}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
          enabled ? 'bg-primary' : 'bg-surface-container-high'
        )}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
