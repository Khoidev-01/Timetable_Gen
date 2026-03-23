'use client';

import { CalendarDays } from 'lucide-react';

export default function AppLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 20, text: 'text-lg', sub: 'text-[10px]' },
    md: { icon: 24, text: 'text-xl', sub: 'text-xs' },
    lg: { icon: 32, text: 'text-2xl', sub: 'text-sm' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25">
        <CalendarDays size={s.icon} className="text-white" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${s.text} font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent`}>
          TKB Pro
        </span>
        <span className={`${s.sub} text-[var(--text-muted)]`}>
          Thời Khóa Biểu
        </span>
      </div>
    </div>
  );
}
