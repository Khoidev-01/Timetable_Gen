'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatDisplayName } from '@/lib/format-display-name';

export interface MyAccount {
  username: string;
  role: 'ADMIN' | 'TEACHER';
  avatar_url: string | null;
  editable: boolean;
  profile: {
    code: string;
    full_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    address: string;
    department: string;
  };
}

const AVATAR_SIZE = 256;

/** Cắt ảnh vuông ở giữa và thu về 256px JPEG, để ảnh gửi lên chỉ vài chục KB. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không đọc được ảnh'));
      img.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d')!;
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AccountAvatar({
  account,
  name,
  size = 32,
  className = '',
}: {
  account?: { avatar_url: string | null } | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (account?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={account.avatar_url} alt="" width={size} height={size} className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-[var(--accent)] font-semibold text-[var(--accent-contrast)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {(name.trim()[0] ?? '?').toLocaleUpperCase('vi-VN')}
    </span>
  );
}

const FIELDS: Array<{ key: keyof MyAccount['profile']; label: string; type?: string; readOnly?: boolean; placeholder?: string }> = [
  { key: 'full_name', label: 'Họ và tên' },
  { key: 'code', label: 'Mã giáo viên', readOnly: true },
  { key: 'department', label: 'Tổ chuyên môn', readOnly: true },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'ten@truong.edu.vn' },
  { key: 'phone', label: 'Số điện thoại', type: 'tel', placeholder: '09xx xxx xxx' },
  { key: 'date_of_birth', label: 'Ngày sinh', type: 'date' },
  { key: 'address', label: 'Địa chỉ', placeholder: 'Số nhà, đường, phường/xã, tỉnh/thành' },
];

export default function MyAccountDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Gọi mỗi khi ảnh hoặc tên thay đổi, để header cập nhật theo. */
  onChanged?: (account: MyAccount) => void;
}) {
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [form, setForm] = useState<MyAccount['profile'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${API_URL}/auth/me`, { headers: headers() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: MyAccount) => {
        if (cancelled) return;
        setAccount(data);
        setForm(data.profile);
      })
      .catch(() => toast('Không tải được thông tin tài khoản', 'error'));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const applyAccount = (data: MyAccount) => {
    setAccount(data);
    setForm(data.profile);
    onChanged?.(data);
  };

  const uploadAvatar = async (avatar: string) => {
    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/auth/me/avatar`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ avatar }) });
      const body = await res.json();
      if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message[0] : body.message);
      applyAccount(body);
      toast(avatar ? 'Đã đổi ảnh đại diện' : 'Đã gỡ ảnh đại diện', 'success');
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'Không lưu được ảnh', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Hãy chọn một tệp ảnh', 'error');
      return;
    }
    try {
      await uploadAvatar(await toAvatarDataUrl(file));
    } catch {
      toast('Không đọc được ảnh này', 'error');
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!account?.editable || !form) return;
    setIsSaving(true);
    try {
      const { full_name, email, phone, date_of_birth, address } = form;
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ full_name, email, phone, date_of_birth, address }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message[0] : body.message);
      applyAccount(body);
      toast('Đã lưu thông tin cá nhân', 'success');
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'Không lưu được thông tin', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = formatDisplayName(account?.profile.full_name || account?.username);
  const inputClass =
    'min-h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] ' +
    'focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-muted)]';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-account-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--bg-surface)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
          <h2 id="my-account-title" className="text-lg font-bold text-[var(--text-primary)]">
            Tài khoản của tôi
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]">
            <X size={20} />
          </button>
        </div>

        {!account || !form ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin" /> Đang tải…
          </p>
        ) : (
          <form onSubmit={save} className="space-y-6 p-6">
            <div className="flex flex-wrap items-center gap-5">
              <AccountAvatar account={account} name={displayName} size={96} />
              <div className="space-y-2">
                <p className="text-base font-semibold text-[var(--text-primary)]">{displayName}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {account.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'} · tên đăng nhập {account.username}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickFile} data-avatar-input />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--accent)] px-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                  >
                    {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                    Đổi ảnh đại diện
                  </button>
                  {account.avatar_url && (
                    <button
                      type="button"
                      onClick={() => uploadAvatar('')}
                      disabled={isUploading}
                      className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                      Gỡ ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!account.editable && (
              <p className="rounded-lg bg-[var(--bg-surface-hover)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tài khoản quản trị không gắn với hồ sơ cá nhân nên không có thông tin để nhập. Bạn vẫn đổi được ảnh đại diện.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.key} className={`block ${field.key === 'address' ? 'sm:col-span-2' : ''}`}>
                  <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{field.label}</span>
                  <input
                    name={field.key}
                    type={field.type ?? 'text'}
                    value={form[field.key]}
                    placeholder={account.editable ? field.placeholder : undefined}
                    disabled={!account.editable || field.readOnly}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--border-default)] pt-4">
              <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-[var(--border-default)] px-4 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">
                Đóng
              </button>
              {account.editable && (
                <button type="submit" disabled={isSaving} className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60">
                  {isSaving && <Loader2 size={15} className="animate-spin" />}
                  Lưu thay đổi
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
