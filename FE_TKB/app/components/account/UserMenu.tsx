'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { formatDisplayName } from '@/lib/format-display-name';
import MyAccountDialog, { AccountAvatar, MyAccount } from './MyAccountDialog';

/**
 * Nút ảnh đại diện ở góc phải header, dùng chung cho quản trị viên và giáo viên:
 * mở "Tài khoản của tôi", (quản trị) cấu hình hệ thống, đăng xuất.
 */
export default function UserMenu({
  user,
  onLogout,
  onOpenSettings,
  onProfileChange,
}: {
  user: { username: string; role: string; full_name?: string };
  onLogout: () => void;
  onOpenSettings?: () => void;
  onProfileChange?: (account: MyAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [account, setAccount] = useState<MyAccount | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setAccount(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const name = formatDisplayName(account?.profile.full_name || user.full_name || user.username);
  const item = 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)]';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tài khoản"
        className="tactile rounded-full shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <AccountAvatar account={account} name={name} size={32} />
      </button>

      {open && (
        <div role="menu" className="dropdown-enter dropdown-stagger absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl">
          <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-3">
            <AccountAvatar account={account} name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--text-primary)]">{name}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'}</p>
            </div>
          </div>
          <div className="py-1">
            <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); setDialogOpen(true); }}>
              <UserRound size={16} />
              Tài khoản của tôi
            </button>
            {onOpenSettings && (
              <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onOpenSettings(); }}>
                <Settings size={16} />
                Cấu hình hệ thống
              </button>
            )}
          </div>
          <div className="border-t border-[var(--border-default)] py-1">
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10">
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      <MyAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onChanged={(data) => {
          setAccount(data);
          onProfileChange?.(data);
        }}
      />
    </div>
  );
}
