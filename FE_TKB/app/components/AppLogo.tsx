'use client';

import Image from 'next/image';

export default function AppLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { img: 32, text: 'text-base', sub: 'text-[10px]' },
    md: { img: 36, text: 'text-lg', sub: 'text-xs' },
    lg: { img: 44, text: 'text-xl', sub: 'text-sm' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="MiKiTimetable" width={s.img} height={s.img} className="rounded-xl" />
      <div className="flex flex-col leading-tight">
        <span className={`${s.text} font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent`}>
          MiKiTimetable
        </span>
        <span className={`${s.sub} text-[var(--text-muted)]`}>
          Thời Khóa Biểu
        </span>
      </div>
    </div>
  );
}
