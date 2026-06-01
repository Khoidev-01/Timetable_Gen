'use client';

import { useEffect, useState } from 'react';

/**
 * Lightweight app-wide toast. Replaces window.alert() everywhere.
 *
 * Usage:
 *   import { toast } from '@/lib/toast';
 *   toast('Đã lưu thành công.');            // success (default)
 *   toast('Xóa thất bại.', 'error');
 *
 * Mount <Toaster /> once near the root of each layout.
 */

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; text: string; kind: ToastKind; }

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(items);
}

export function toast(text: string, kind: ToastKind = 'success') {
  const id = ++seq;
  items = [...items, { id, text, kind }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  error: 'border-red-500 text-red-700 bg-red-50',
  info: 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]',
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed right-6 top-20 z-[70] flex flex-col gap-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-rise pointer-events-auto rounded-[var(--radius-md)] border-l-4 px-5 py-3 text-sm font-medium shadow-[var(--shadow-lg)] max-w-sm ${STYLES[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
