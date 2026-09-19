'use client';

import Image from 'next/image';

export default function AppLogo({
  size = 'md',
  tone = 'dark',
  showSubtitle = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  showSubtitle?: boolean;
}) {
  const sizes = {
    sm: { img: 32, text: 'text-base', sub: 'text-[10px]' },
    md: { img: 36, text: 'text-lg', sub: 'text-xs' },
    lg: { img: 44, text: 'text-xl', sub: 'text-sm' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <Image src="/favicon.svg?v=2" alt="MiKiTimetable" width={s.img} height={s.img} className="rounded-[var(--radius-md)]" />
      <div className="flex flex-col leading-tight">
        <span className={`${s.text} font-bold tracking-tight ${tone === 'light' ? 'text-[var(--landing-ink)]' : 'text-white'}`}>
          MiKiTimetable
        </span>
        {showSubtitle && (
          <span className={`${s.sub} ${tone === 'light' ? 'text-[var(--landing-muted)]' : 'text-[var(--text-muted)]'}`}>
            Thời Khóa Biểu
          </span>
        )}
      </div>
    </div>
  );
}
