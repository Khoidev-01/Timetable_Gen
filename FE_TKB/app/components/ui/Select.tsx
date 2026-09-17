'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Mặc định tự bật khi danh sách dài hơn 8 lựa chọn. */
  searchable?: boolean;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Lớp cho phần bọc ngoài, dùng để đặt độ rộng (mặc định w-full). */
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
  'aria-label'?: string;
}

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 340;

export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Chọn...',
  searchable,
  searchPlaceholder = 'Tìm kiếm...',
  required = false,
  disabled = false,
  className = 'w-full',
  size = 'md',
  id,
  'aria-label': ariaLabel,
}: SelectProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ left: 0, top: 0, bottom: 0, width: 0, maxHeight: MENU_MAX_HEIGHT, above: false });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('vi').includes(needle));
  }, [options, query]);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - 12;
    const spaceAbove = rect.top - MENU_GAP - 12;
    const above = spaceBelow < 240 && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, 200);
    const left = Math.min(rect.left, window.innerWidth - width - 12);
    setPosition({
      left: Math.max(12, left),
      top: rect.bottom + MENU_GAP,
      bottom: window.innerHeight - rect.top + MENU_GAP,
      width,
      maxHeight: Math.max(160, Math.min(MENU_MAX_HEIGHT, above ? spaceAbove : spaceBelow)),
      above,
    });
  }, []);

  const openMenu = () => {
    if (disabled) return;
    updatePosition();
    setQuery('');
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    closeMenu();
  };

  useLayoutEffect(() => {
    if (!open) return;
    if (withSearch) searchRef.current?.focus({ preventScroll: true });
    else listRef.current?.focus({ preventScroll: true });
  }, [open, withSearch]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu(false);
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, updatePosition]);

  // Giữ lựa chọn đang trỏ luôn nằm trong vùng nhìn thấy khi dùng phím mũi tên.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const move = (step: number) => {
    if (filtered.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + step + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setActiveIndex(next);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); move(1); break;
      case 'ArrowUp': event.preventDefault(); move(-1); break;
      case 'Home': if (!withSearch) { event.preventDefault(); setActiveIndex(0); } break;
      case 'End': if (!withSearch) { event.preventDefault(); setActiveIndex(filtered.length - 1); } break;
      case 'Enter': event.preventDefault(); if (filtered[activeIndex]) choose(filtered[activeIndex]); break;
      case 'Escape': event.preventDefault(); event.stopPropagation(); closeMenu(); break;
      case 'Tab': closeMenu(false); break;
    }
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  };

  const heightClass = size === 'sm' ? 'min-h-10 px-3' : 'min-h-11 px-3';
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-[var(--bg-surface)] text-left text-sm transition-[border-color,box-shadow] duration-150 hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-default)] ${heightClass} ${open ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]' : 'border-[var(--border-default)]'}`}
      >
        <span className={`truncate ${selected ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Giữ kiểm tra "bắt buộc" của form như select gốc. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => undefined}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      )}

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className={`dropdown-enter fixed z-[1000] flex flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl ${position.above ? 'origin-bottom' : 'origin-top'}`}
          style={{
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            ...(position.above ? { bottom: position.bottom } : { top: position.top }),
          }}
        >
          {withSearch && (
            <div className="border-b border-[var(--border-default)] p-2">
              <label className="flex min-h-9 items-center gap-2 rounded-lg bg-[var(--bg-surface-hover)] px-2.5 ring-[var(--accent)] focus-within:ring-2">
                <Search size={15} className="shrink-0 text-[var(--text-muted)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                  placeholder={searchPlaceholder}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  style={{ boxShadow: 'none' }}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>
            </div>
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={withSearch ? undefined : activeId}
            style={{ boxShadow: 'none' }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 outline-none"
          >
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onPointerMove={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={`flex min-h-10 cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 ${option.disabled ? 'cursor-not-allowed opacity-40' : ''} ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'} ${isActive ? 'bg-[var(--bg-surface-hover)]' : ''} ${isSelected && !isActive ? 'bg-[var(--accent-soft)]' : ''}`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}>{option.label}</span>
                    {option.description && <span className="mt-0.5 block text-xs leading-4 text-[var(--text-muted)]">{option.description}</span>}
                  </span>
                  {isSelected && <Check size={16} className="mt-0.5 shrink-0" />}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">Không tìm thấy lựa chọn phù hợp.</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
