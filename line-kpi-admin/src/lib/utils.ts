import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMs(ms?: number): string {
  if (!ms) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)} วิ`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} นาที`;
  return `${(ms / 3600000).toFixed(1)} ชม.`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function maskLineId(id: string): string {
  if (id.length <= 8) return id;
  return id.slice(0, 8) + '...';
}
