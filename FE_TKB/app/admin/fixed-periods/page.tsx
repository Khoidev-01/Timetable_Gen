'use client';
import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, Pin, Plus, Trash2 } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface FixedPeriodRule {
  id: string;
  name: string;
  subject_code: string;
  day_of_week: number;
  period: number;
  grade_level: number | null;
  main_session: number | null;
  teacher_rule: 'HOMEROOM' | 'BGH' | 'ASSIGNED';
  is_locked: boolean;
  is_active: boolean;
  sort_order: number;
}

const DAYS = [2, 3, 4, 5, 6, 7];
const TEACHER_RULES: Array<{ value: FixedPeriodRule['teacher_rule']; label: string }> = [
  { value: 'HOMEROOM', label: 'Giáo viên chủ nhiệm' },
  { value: 'BGH', label: 'Ban giám hiệu' },
  { value: 'ASSIGNED', label: 'GV được phân công môn' },
];

const emptyDraft = {
  name: '',
  subject_code: '',
  day_of_week: 2,
  period: 1,
  grade_level: '' as string | number,
  main_session: '' as string | number,
  teacher_rule: 'HOMEROOM' as FixedPeriodRule['teacher_rule'],
  is_locked: true,
};

export default function FixedPeriodsPage() {
  const [rules, setRules] = useState<FixedPeriodRule[]>([]);
  const [subjects, setSubjects] = useState<Array<{ code: string; name: string }>>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const [ruleRes, subjectRes] = await Promise.all([
        fetch(`${API_URL}/tiet-co-dinh`, { headers: authHeaders() }),
        fetch(`${API_URL}/resources/subjects`, { headers: authHeaders() }),
      ]);
      if (ruleRes.ok) setRules(await ruleRes.json());
      if (subjectRes.ok) setSubjects(await subjectRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreate = async () => {
    if (!draft.name.trim() || !draft.subject_code.trim()) {
      notify('Cần nhập tên quy tắc và mã môn.', false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tiet-co-dinh`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...draft,
          grade_level: draft.grade_level === '' ? null : Number(draft.grade_level),
          main_session: draft.main_session === '' ? null : Number(draft.main_session),
          sort_order: rules.length + 1,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        notify(body?.message ?? 'Không tạo được quy tắc.', false);
        return;
      }

      setDraft(emptyDraft);
      await load();
      notify('Đã thêm quy tắc tiết cố định.', true);
    } catch (error) {
      console.error(error);
      notify('Lỗi kết nối.', false);
    }
  };

  const patchRule = async (rule: FixedPeriodRule, changes: Partial<FixedPeriodRule>) => {
    try {
      const res = await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ...rule, ...changes }),
      });
      if (res.ok) setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, ...changes } : r)));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (rule: FixedPeriodRule) => {
    try {
      const res = await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
        notify('Đã xoá quy tắc.', true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const describeScope = (rule: FixedPeriodRule) => {
    const parts: string[] = [];
    parts.push(rule.grade_level === null ? 'Mọi khối' : `Khối ${rule.grade_level}`);
    if (rule.main_session === 0) parts.push('lớp buổi sáng');
    else if (rule.main_session === 1) parts.push('lớp buổi chiều');
    else parts.push('mọi buổi');
    return parts.join(' · ');
  };

  const inputClass =
    'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]';

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
        <div className="flex items-center gap-2 mb-1">
          <Pin size={20} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tiết cố định</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Những tiết nhà trường ấn định trước khi chạy thuật toán — chào cờ, sinh hoạt, giáo dục địa
          phương… Tiết được <strong>khoá</strong> sẽ không bị thuật toán hay thao tác kéo thả di chuyển.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Thêm quy tắc */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)] space-y-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Thêm quy tắc mới</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Tên quy tắc</span>
            <input
              className={inputClass}
              value={draft.name}
              placeholder="Chào cờ đầu tuần"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Môn</span>
            <select
              className={inputClass}
              value={draft.subject_code}
              onChange={(e) => setDraft({ ...draft, subject_code: e.target.value })}
            >
              <option value="">— Chọn môn —</option>
              <option value="GVCN_TEACHING">Tiết của GVCN (môn bất kỳ)</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Thứ</span>
            <select
              className={inputClass}
              value={draft.day_of_week}
              onChange={(e) => setDraft({ ...draft, day_of_week: Number(e.target.value) })}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  Thứ {d}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Tiết (1–5 sáng, 6–10 chiều)</span>
            <input
              type="number"
              min={1}
              max={10}
              className={inputClass}
              value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Khối</span>
            <select
              className={inputClass}
              value={draft.grade_level}
              onChange={(e) => setDraft({ ...draft, grade_level: e.target.value })}
            >
              <option value="">Mọi khối</option>
              <option value="10">Khối 10</option>
              <option value="11">Khối 11</option>
              <option value="12">Khối 12</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Buổi học của lớp</span>
            <select
              className={inputClass}
              value={draft.main_session}
              onChange={(e) => setDraft({ ...draft, main_session: e.target.value })}
            >
              <option value="">Mọi buổi</option>
              <option value="0">Lớp học buổi sáng</option>
              <option value="1">Lớp học buổi chiều</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-[var(--text-muted)]">Giáo viên phụ trách</span>
            <select
              className={inputClass}
              value={draft.teacher_rule}
              onChange={(e) =>
                setDraft({ ...draft, teacher_rule: e.target.value as FixedPeriodRule['teacher_rule'] })
              }
            >
              {TEACHER_RULES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={draft.is_locked}
              onChange={(e) => setDraft({ ...draft, is_locked: e.target.checked })}
            />
            <span className="text-[var(--text-primary)]">Khoá tiết sau khi xếp</span>
          </label>
        </div>

        <button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg
            transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Thêm quy tắc
        </button>
      </div>

      {/* Danh sách */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
              <tr>
                <th className="p-3 text-left">Tên</th>
                <th className="p-3 text-left">Môn</th>
                <th className="p-3 text-left">Thời điểm</th>
                <th className="p-3 text-left">Áp dụng cho</th>
                <th className="p-3 text-left">Giáo viên</th>
                <th className="p-3 text-center">Khoá</th>
                <th className="p-3 text-center">Bật</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-primary)]">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[var(--text-muted)]">
                    Đang tải…
                  </td>
                </tr>
              )}

              {!isLoading && rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[var(--text-muted)]">
                    Chưa có quy tắc nào. Thuật toán sẽ bỏ qua bước xếp tiết cố định.
                  </td>
                </tr>
              )}

              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-[var(--border-default)]">
                  <td className="p-3 font-medium">{rule.name}</td>
                  <td className="p-3">
                    <code className="text-xs">{rule.subject_code}</code>
                  </td>
                  <td className="p-3">
                    Thứ {rule.day_of_week} · tiết {rule.period}
                    <span className="text-[var(--text-muted)]">
                      {' '}
                      ({rule.period <= 5 ? 'sáng' : 'chiều'})
                    </span>
                  </td>
                  <td className="p-3 text-[var(--text-muted)]">{describeScope(rule)}</td>
                  <td className="p-3 text-[var(--text-muted)]">
                    {TEACHER_RULES.find((r) => r.value === rule.teacher_rule)?.label}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => patchRule(rule, { is_locked: !rule.is_locked })}
                      title={rule.is_locked ? 'Đang khoá' : 'Không khoá'}
                      className={rule.is_locked ? 'text-amber-500' : 'text-[var(--text-muted)]'}
                    >
                      {rule.is_locked ? <Lock size={16} /> : <LockOpen size={16} />}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      onChange={() => patchRule(rule, { is_active: !rule.is_active })}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(rule)}
                      className="text-red-500 hover:text-red-600"
                      title="Xoá"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
