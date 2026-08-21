'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Lock, RotateCcw, Settings, Sliders } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface ConstraintSetting {
  key: string;
  kind: 'PENALTY' | 'HARD' | 'SOFT';
  code: string;
  name: string;
  description: string;
  defaultWeight: number;
  canDisable: boolean;
  weight: number;
  isActive: boolean;
  isOverridden: boolean;
}

export default function ConfigurationPage() {
  const [settings, setSettings] = useState<ConstraintSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/cau-hinh-rang-buoc`, { headers: authHeaders() });
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (key: string, changes: { weight?: number; isActive?: boolean }) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/cau-hinh-rang-buoc/${key}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(changes),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.message ?? 'Không lưu được thay đổi');
        await load(); // put the row back to what the server actually holds
        return;
      }
      setSettings((prev) => prev.map((s) => (s.key === key ? body : s)));
    } catch {
      setError('Không kết nối được máy chủ');
    }
  };

  const resetAll = async () => {
    await fetch(`${API_URL}/cau-hinh-rang-buoc/khoi-phuc-mac-dinh`, {
      method: 'POST',
      headers: authHeaders(),
    });
    await load();
  };

  const penalty = settings.find((s) => s.kind === 'PENALTY');
  const hard = settings.filter((s) => s.kind === 'HARD');
  const soft = settings.filter((s) => s.kind === 'SOFT');
  const changedCount = settings.filter((s) => s.isOverridden).length;

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải cấu hình…</p>;
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <Settings size={24} className="text-blue-500" />
            Cấu hình ràng buộc
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Thuật toán đọc đúng những con số dưới đây. Thay đổi có hiệu lực từ lần xếp thời
            khóa biểu tiếp theo — thời khóa biểu đang có không tự tính lại.
          </p>
        </div>

        {changedCount > 0 && (
          <button
            onClick={resetAll}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <RotateCcw size={15} />
            Khôi phục mặc định ({changedCount})
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Mức phạt lỗi cứng */}
      {penalty && (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-56 flex-1">
              <h2 className="font-semibold text-[var(--text-primary)]">{penalty.name}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{penalty.description}</p>
            </div>
            <WeightInput setting={penalty} onCommit={(w) => patch(penalty.key, { weight: w })} />
          </div>
        </section>
      )}

      {/* Ràng buộc cứng */}
      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <header className="border-b border-[var(--border-default)] bg-red-500/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-red-700 dark:text-red-400">Ràng buộc cứng</h2>
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
              {hard.length} ràng buộc
            </span>
          </div>
          <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">
            Vi phạm một trong số này thì thời khóa biểu không dùng được. Mọi lỗi cứng đều bị
            trừ cùng một mức phạt ở trên.
          </p>
        </header>

        <ul className="divide-y divide-[var(--border-light)]">
          {hard.map((setting) => (
            <li key={setting.key} className="flex flex-wrap items-start gap-4 p-5">
              <div className="min-w-56 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <code className="rounded bg-[var(--bg-surface-hover)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                    {setting.code}
                  </code>
                  <h3 className="font-semibold text-[var(--text-primary)]">{setting.name}</h3>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{setting.description}</p>
              </div>

              {setting.canDisable ? (
                <Toggle
                  checked={setting.isActive}
                  colour="red"
                  onChange={() => patch(setting.key, { isActive: !setting.isActive })}
                />
              ) : (
                <span
                  title="Một thời khóa biểu vi phạm điều này là không thực hiện được, không phải kém tối ưu"
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-hover)] px-3 py-1.5 text-sm text-[var(--text-muted)]"
                >
                  <Lock size={14} /> Luôn bật
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Ràng buộc mềm */}
      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <header className="border-b border-[var(--border-default)] bg-blue-500/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
              <Sliders size={17} /> Ràng buộc mềm
            </h2>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
              {soft.length} ràng buộc
            </span>
          </div>
          <p className="mt-1 text-sm text-blue-600/80 dark:text-blue-400/80">
            Vi phạm bị trừ điểm nhưng thời khóa biểu vẫn dùng được. Trọng số càng cao,
            thuật toán càng cố tránh.
          </p>
        </header>

        <ul className="divide-y divide-[var(--border-light)]">
          {soft.map((setting) => (
            <li
              key={setting.key}
              className={`flex flex-wrap items-start gap-4 p-5 ${setting.isActive ? '' : 'opacity-55'}`}
            >
              <div className="min-w-56 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-[var(--bg-surface-hover)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                    {setting.code}
                  </code>
                  <h3 className="font-semibold text-[var(--text-primary)]">{setting.name}</h3>
                  {setting.isOverridden && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      đã sửa · mặc định {setting.defaultWeight}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)]">{setting.description}</p>
              </div>

              <div className="flex items-center gap-5">
                <WeightInput
                  setting={setting}
                  disabled={!setting.isActive}
                  onCommit={(w) => patch(setting.key, { weight: w })}
                />
                <Toggle
                  checked={setting.isActive}
                  colour="blue"
                  onChange={() => patch(setting.key, { isActive: !setting.isActive })}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WeightInput({
  setting,
  disabled,
  onCommit,
}: {
  setting: ConstraintSetting;
  disabled?: boolean;
  onCommit: (weight: number) => void;
}) {
  const [draft, setDraft] = useState(String(setting.weight));

  useEffect(() => {
    setDraft(String(setting.weight));
  }, [setting.weight]);

  return (
    <label className="flex flex-col items-end">
      <span className="mb-1 text-xs text-[var(--text-muted)]">Trọng số</span>
      <input
        type="number"
        min={0}
        max={1000}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number(draft);
          if (!Number.isInteger(parsed) || parsed < 0) {
            setDraft(String(setting.weight));
            return;
          }
          if (parsed !== setting.weight) onCommit(parsed);
        }}
        className="w-24 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 text-right text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
    </label>
  );
}

function Toggle({
  checked,
  colour,
  onChange,
}: {
  checked: boolean;
  colour: 'red' | 'blue';
  onChange: () => void;
}) {
  const on = colour === 'red' ? 'peer-checked:bg-red-600' : 'peer-checked:bg-blue-600';

  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <div
        className={`h-6 w-11 rounded-full bg-[var(--border-light)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white ${on}`}
      />
      <span className="ml-3 w-10 text-sm font-medium text-[var(--text-muted)]">
        {checked ? 'Bật' : 'Tắt'}
      </span>
    </label>
  );
}
