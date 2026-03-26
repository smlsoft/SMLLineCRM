'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.login({ username, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg className="w-8 h-8 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">LINE KPI Admin</h1>
          <p className="text-sm text-on-surface-variant mt-1">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        {/* Card */}
        <div className="bg-surface-container rounded-2xl p-8 shadow-sm border border-surface-container-high/40">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl border border-outline/30 bg-surface text-on-surface text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  disabled:opacity-50 disabled:cursor-not-allowed
                  placeholder:text-on-surface-variant/50"
                placeholder="กรอกชื่อผู้ใช้"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">
                รหัสผ่าน
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl border border-outline/30 bg-surface text-on-surface text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  disabled:opacity-50 disabled:cursor-not-allowed
                  placeholder:text-on-surface-variant/50"
                placeholder="กรอกรหัสผ่าน"
              />
            </div>

            {error && (
              <div className="bg-error-container/20 border border-error/20 rounded-xl px-4 py-3">
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-semibold text-sm
                hover:opacity-90 active:scale-[0.98] transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
