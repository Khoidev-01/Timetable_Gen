'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import { API_URL } from '@/lib/api';

type Level = 'BUSY' | 'AVOID' | 'PREFER';

interface Cell {
  day: number;
  period: number;
  session: number;
  type: Level;
}

const DAYS = [2, 3, 4, 5, 6, 7];
const DAY_LABEL: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
const PERIODS = [1, 2, 3, 4, 5];

const LEVELS: Array<{ key: Level; label: string; meaning: string; cell: string; swatch: string }> = [
  {
    key: 'BUSY',
    label: 'Bận',
    meaning: 'Không thể dạy — họp, đi học, đưa đón con. Hệ thống tuyệt đối không xếp.',
    cell: 'bg-red-500 text-white',
    swatch: 'bg-red-500',
  },
  {
    key: 'AVOID',
    label: 'Hạn chế',
    meaning: 'Dạy được nhưng không muốn. Hệ thống cố tránh, vẫn xếp nếu không còn cách.',
    cell: 'bg-amber-400 text-amber-950',
    swatch: 'bg-amber-400',
  },
  {
    key: 'PREFER',
    label: 'Mong muốn',
    meaning: 'Thích dạy giờ này. Hệ thống được cộng điểm khi xếp đúng vào đây.',
    cell: 'bg-emerald-500 text-white',
    swatch: 'bg-emerald-500',
  },
];

const key = (day: number, session: number, period: number) => `${day}|${session}|${period}`;

export default function PreferencesPage() {
  const [cells, setCells] = useState<Map<string, Level>>(new Map());
  const [brush, setBrush] = useState<Level>('BUSY');
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const [isLoading, setIsLoading] = useState(true);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const me = await fetch(`${API_URL}/auth/profile`, { headers: authHeaders() });
      if (!me.ok) return;
      const profile = await me.json();
      const id = profile.teacher_profile_id ?? profile.teacherId ?? profile.teacher?.id;
      if (!id) return;
      setTeacherId(id);

      const res = await fetch(`${API_URL}/giao-vien/${id}/preferences`, { headers: authHeaders() });
      if (!res.ok) return;

      const rows: Cell[] = await res.json();
      const next = new Map<string, Level>();
      for (const row of rows) {
        // session 2 means the same period in both halves of the day
        for (const session of row.session === 2 ? [0, 1] : [row.session]) {
          next.set(key(row.day, session, row.period), row.type);
        }
      }
      setCells(next);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paint = (day: number, session: number, period: number) => {
    setStatus('idle');
    setCells((previous) => {
      const next = new Map(previous);
      const k = key(day, session, period);
      // Clicking a cell that already holds the current level clears it
      if (next.get(k) === brush) next.delete(k);
      else next.set(k, brush);
      return next;
    });
  };

  const save = async () => {
    setStatus('saving');
    const busySlots = [...cells.entries()].map(([k, type]) => {
      const [day, session, period] = k.split('|').map(Number);
      return { day, session, period, type };
    });

    try {
      const res = await fetch(`${API_URL}/giao-vien/${teacherId}/busy-time`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ busySlots }),
      });
      const body = await res.json().catch(() => ({}));
      setStatus(res.ok ? 'saved' : (body.message ?? 'Không lưu được'));
    } catch {
      setStatus('Không kết nối được máy chủ');
    }
  };

  const counts = LEVELS.map((level) => ({
    ...level,
    count: [...cells.values()].filter((v) => v === level.key).length,
  }));

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>;
  }

  if (!teacherId) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Tài khoản của bạn chưa được liên kết với hồ sơ giáo viên. Liên hệ quản trị viên để
        đăng ký nguyện vọng.
      </p>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đăng ký nguyện vọng</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Đánh dấu ba mức khác nhau cho từng khung giờ. Phân biệt được &ldquo;không thể&rdquo;
          với &ldquo;không muốn&rdquo; là điều giúp trường vẫn xếp được lịch mà vẫn nghe được
          nguyện vọng của bạn.
        </p>
      </div>

      {/* Chọn mức để tô */}
      <div className="flex flex-wrap gap-2">
        {counts.map((level) => (
          <button
            key={level.key}
            onClick={() => setBrush(level.key)}
            className={`flex-1 min-w-56 rounded-xl border-2 p-3 text-left transition-all ${
              brush === level.key
                ? 'border-[var(--text-primary)] bg-[var(--bg-surface-hover)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded ${level.swatch}`} />
              <span className="font-semibold text-[var(--text-primary)]">{level.label}</span>
              <span className="ml-auto text-sm text-[var(--text-muted)]">{level.count} ô</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{level.meaning}</p>
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Bấm vào ô để tô mức đang chọn. Bấm lại đúng ô đó để xoá.
      </p>

      {/* Lưới tuần */}
      <div className="space-y-4">
        {[0, 1].map((session) => (
          <div
            key={session}
            className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <h2 className="mb-3 font-semibold text-[var(--text-primary)]">
              {session === 0 ? 'Buổi sáng' : 'Buổi chiều'}
            </h2>
            <table className="w-full min-w-[520px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-16" />
                  {DAYS.map((day) => (
                    <th key={day} className="pb-1 text-xs font-medium text-[var(--text-muted)]">
                      {DAY_LABEL[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="pr-2 text-right text-xs text-[var(--text-muted)]">Tiết {period}</td>
                    {DAYS.map((day) => {
                      const level = cells.get(key(day, session, period));
                      const style = LEVELS.find((l) => l.key === level);
                      return (
                        <td key={day}>
                          <button
                            onClick={() => paint(day, session, period)}
                            aria-label={`${DAY_LABEL[day]} tiết ${period} ${session === 0 ? 'sáng' : 'chiều'}${style ? ` — ${style.label}` : ''}`}
                            className={`h-9 w-full rounded-md text-xs font-medium transition-colors ${
                              style?.cell ?? 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:bg-[var(--border-light)]'
                            }`}
                          >
                            {style?.label ?? ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={status === 'saving'}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Lưu đăng ký
        </button>

        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Check size={16} /> Đã lưu — sẽ áp dụng từ lần xếp lịch tiếp theo
          </span>
        )}
        {typeof status === 'string' && !['idle', 'saving', 'saved'].includes(status) && (
          <span className="text-sm text-red-600">{status}</span>
        )}
      </div>
    </div>
  );
}
