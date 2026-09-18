'use client';

import { useMemo, useState } from 'react';

/** Mỗi trang 10 dòng, dùng chung cho các bảng quản trị. */
export const PAGE_SIZE = 10;

/**
 * Cắt một danh sách thành từng trang.
 *
 * Trang đang xem được kẹp lại theo số trang hiện có: xoá bớt dòng hoặc đổi bộ lọc có thể làm
 * trang đó không còn tồn tại, và khi ấy bảng phải hiện trang cuối chứ không hiện trống.
 */
export function usePaged<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visible = useMemo(() => items.slice(pageStart, pageStart + pageSize), [items, pageStart, pageSize]);

  return { visible, currentPage, totalPages, pageStart, pageSize, total: items.length, setPage };
}

const PAGER_BUTTON =
  'min-h-10 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm font-medium ' +
  'text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40';

/** Thanh chuyển trang đặt dưới bảng. Chỉ hiện khi có nhiều hơn một trang. */
export function Pager({
  paged,
  noun,
  label,
  keepVisible = false,
}: {
  paged: ReturnType<typeof usePaged<unknown>>;
  /** Danh từ đếm, ví dụ "tài khoản", "lớp". */
  noun: string;
  label: string;
  /** Vẫn hiện khi chỉ có một trang, để bảng giữ nguyên chiều cao lúc lọc. */
  keepVisible?: boolean;
}) {
  const { currentPage, totalPages, pageStart, pageSize, total, setPage } = paged;
  if (total <= pageSize && !keepVisible) return null;

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] px-4 py-3"
      aria-label={label}
    >
      <p className="text-sm text-[var(--text-muted)]">
        {total === 0
          ? `Không có ${noun} nào`
          : `Hiển thị ${pageStart + 1}-${Math.min(pageStart + pageSize, total)} trong ${total} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={PAGER_BUTTON}
        >
          Trước
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-[var(--text-primary)]">
          Trang {currentPage}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={PAGER_BUTTON}
        >
          Sau
        </button>
      </div>
    </nav>
  );
}

export interface FilterOption<V extends string | number> {
  value: V;
  label: string;
  count: number;
}

/** Một hàng nút lọc, mỗi nút kèm số dòng thuộc nhóm đó. */
export function FilterChips<V extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {option.label}
            <span
              className={`rounded-full px-2 text-xs ${
                active ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'
              }`}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
