'use client';
import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConstraintConfig {
  id: string; ma_rang_buoc: string; ten_rang_buoc: string;
  loai: 'HARD' | 'SOFT'; trong_so: number; is_active: boolean; mo_ta: string;
}

interface Semester {
  id: string; name: string; is_current: boolean;
  start_date?: string; end_date?: string; term_order: number;
}

interface AcademicYear {
  id: string; name: string; start_date?: string; end_date?: string;
  status: string; semesters: Semester[];
}

// ─── Constraints Tab ─────────────────────────────────────────────────────────

function ConstraintsTab() {
  const [constraints, setConstraints] = useState<ConstraintConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/cau-hinh-rang-buoc`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      data.sort((a: ConstraintConfig, b: ConstraintConfig) => {
        if (a.loai !== b.loai) return a.loai === 'HARD' ? -1 : 1;
        return a.ma_rang_buoc.localeCompare(b.ma_rang_buoc);
      });
      setConstraints(data);
    }
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, []);

  const patch = async (id: string, body: any) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/cau-hinh-rang-buoc/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    if (res.ok) setConstraints(prev => prev.map(c => c.id === id ? { ...c, ...body } : c));
  };

  const hard = constraints.filter(c => c.loai === 'HARD');
  const soft = constraints.filter(c => c.loai === 'SOFT');

  if (loading) return <div className="text-center py-10 text-[var(--text-muted)]">Đang tải...</div>;

  return (
    <div className="space-y-8">
      {/* Hard */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-red-800">Ràng buộc Cứng (Hard Constraints)</h2>
            <p className="text-sm text-red-600 mt-0.5">Vi phạm → TKB không hợp lệ</p>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{hard.length} Rules</span>
        </div>
        <div className="divide-y divide-[var(--border-light)]">
          {hard.map(c => (
            <div key={c.id} className="p-6 flex items-start justify-between gap-4 hover:bg-[var(--bg-surface-hover)]">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-gray-400 bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded">{c.ma_rang_buoc}</span>
                  <h3 className="font-semibold text-[var(--text-primary)]">{c.ten_rang_buoc}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{c.mo_ta}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={c.is_active} onChange={() => patch(c.id, { is_active: !c.is_active })} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
                <span className="ml-3 text-sm text-[var(--text-secondary)] w-10">{c.is_active ? 'Bật' : 'Tắt'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Soft */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-blue-800">Ràng buộc Mềm (Soft Constraints)</h2>
            <p className="text-sm text-blue-600 mt-0.5">Vi phạm → trừ điểm Fitness, TKB vẫn hợp lệ</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{soft.length} Rules</span>
        </div>
        <div className="divide-y divide-[var(--border-light)]">
          {soft.map(c => (
            <div key={c.id} className="p-6 flex items-start justify-between gap-4 hover:bg-[var(--bg-surface-hover)]">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-gray-400 bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded">{c.ma_rang_buoc}</span>
                  <h3 className="font-semibold text-[var(--text-primary)]">{c.ten_rang_buoc}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{c.mo_ta}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <label className="text-xs text-[var(--text-muted)] mb-1">Trọng số</label>
                  <input type="number" className="w-20 text-right p-1.5 border border-[var(--border-default)] rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={c.trong_so}
                    onChange={e => setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, trong_so: +e.target.value } : x))}
                    onBlur={e => patch(c.id, { trong_so: +e.target.value })} />
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={c.is_active} onChange={() => patch(c.id, { is_active: !c.is_active })} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  <span className="ml-3 text-sm text-[var(--text-secondary)] w-10">{c.is_active ? 'Bật' : 'Tắt'}</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Academic Years Tab ───────────────────────────────────────────────────────

function AcademicYearsTab() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editSem, setEditSem] = useState<{ id: string; start_date: string; end_date: string } | null>(null);

  const token = () => localStorage.getItem('token') ?? '';

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  const fetchYears = useCallback(async () => {
    const res = await fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setYears(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => { fetchYears(); }, [fetchYears]);

  const deleteSemester = async (semId: string, semName: string) => {
    if (!confirm(`Xóa học kỳ "${semName}"? Chỉ xóa được nếu chưa có phân công hoặc TKB.`)) return;
    const res = await fetch(`${API_URL}/system/semesters/${semId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast(`Đã xóa ${semName}`); fetchYears(); }
    else { const d = await res.json(); showToast(d.message || 'Xóa thất bại', false); }
  };

  const deleteYear = async (yearId: string, yearName: string) => {
    if (!confirm(`Xóa năm học "${yearName}" và toàn bộ học kỳ? Chỉ xóa được nếu chưa có dữ liệu.`)) return;
    const res = await fetch(`${API_URL}/system/years/${yearId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast(`Đã xóa ${yearName}`); fetchYears(); }
    else { const d = await res.json(); showToast(d.message || 'Xóa thất bại', false); }
  };

  const saveSemDates = async () => {
    if (!editSem) return;
    const res = await fetch(`${API_URL}/system/semesters/${editSem.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ start_date: editSem.start_date || null, end_date: editSem.end_date || null }),
    });
    if (res.ok) { showToast('Đã cập nhật ngày học kỳ'); setEditSem(null); fetchYears(); }
    else showToast('Lỗi cập nhật', false);
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const toInput = (d?: string) => d ? new Date(d).toISOString().slice(0, 10) : '';

  if (loading) return <div className="text-center py-10 text-[var(--text-muted)]">Đang tải...</div>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed right-6 top-20 z-50 rounded-lg border-l-4 px-5 py-3 shadow-lg font-semibold text-sm
          ${toast.ok ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {years.length === 0 && <p className="text-center py-10 text-[var(--text-muted)]">Chưa có năm học nào</p>}

      {years.map(y => (
        <div key={y.id} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
          {/* Year header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)]">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[var(--text-primary)]">{y.name}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${y.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {y.status === 'ACTIVE' ? 'Đang hoạt động' : y.status}
              </span>
              {y.start_date && <span className="text-xs text-[var(--text-muted)]">{fmt(y.start_date)} → {fmt(y.end_date)}</span>}
            </div>
            <button onClick={() => deleteYear(y.id, y.name)}
              className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-300 hover:border-red-500 px-3 py-1 rounded-lg transition-colors">
              Xóa năm học
            </button>
          </div>

          {/* Semesters */}
          <div className="divide-y divide-[var(--border-light)]">
            {y.semesters.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{s.name}</span>
                  {s.is_current && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Hiện tại</span>}
                  <span className="text-xs text-[var(--text-muted)]">{fmt(s.start_date)} → {fmt(s.end_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditSem({ id: s.id, start_date: toInput(s.start_date), end_date: toInput(s.end_date) })}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium">Sửa ngày</button>
                  <button onClick={() => deleteSemester(s.id, s.name)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg transition-colors">
                    Xóa HK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit semester dates dialog */}
      {editSem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-surface)] shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-[var(--text-primary)]">Cập nhật ngày học kỳ</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ngày bắt đầu</label>
                <input type="date" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={editSem.start_date} onChange={e => setEditSem(v => v ? { ...v, start_date: e.target.value } : null)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ngày kết thúc</label>
                <input type="date" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={editSem.end_date} onChange={e => setEditSem(v => v ? { ...v, end_date: e.target.value } : null)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditSem(null)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] text-sm">Hủy</button>
              <button onClick={saveSemDates}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const [tab, setTab] = useState<'constraints' | 'years'>('constraints');

  return (
    <div className="space-y-5 pb-20">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cấu hình hệ thống</h1>

      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {([
          { key: 'constraints', label: 'Ràng buộc thuật toán' },
          { key: 'years', label: 'Năm học & Học kỳ' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'constraints' && <ConstraintsTab />}
      {tab === 'years' && <AcademicYearsTab />}
    </div>
  );
}
