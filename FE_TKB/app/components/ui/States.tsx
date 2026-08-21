'use client';

import React from 'react';

/**
 * Shared loading / empty state primitives used across admin tables and panels.
 * Replaces ad-hoc "Đang tải..." text and bare empty rows.
 */

/** A single shimmering bar, sized by className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block rounded bg-[var(--bg-surface-hover)] animate-pulse ${className}`} />;
}

/**
 * Skeleton rows shaped like the final table. Render inside <tbody> while loading.
 */
export function TableSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-[var(--border-light)]">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-6 py-4">
              <Skeleton className={`h-4 ${c === 0 ? 'w-16' : c === cols - 1 ? 'w-20 ml-auto' : 'w-28'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Composed empty state with an icon, title and optional action.
 * Use inside a full-width <td colSpan> or a panel.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center animate-rise">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      <div>
        <p className="font-medium text-[var(--text-secondary)]">{title}</p>
        {hint && <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
