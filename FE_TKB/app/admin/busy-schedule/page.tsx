'use client';
import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '@/lib/api';

const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

interface SchoolYear { id: string; name: string; semesters: { id: string; name: string }[] }
interface BusyRequest {
  id: string; teacher: { full_name: string; code: string };
  week_number: number; day_of_week: number; period: number;
  reason: string; status: string; rejection_note?: string;
  reviewed_at?: string; created_at: string;
}
interface Conflict {
  busyRequestId: string; timetableSlotId: string;
  teacher: { full_name: string; code: string };
  weekNumber: number; dayOfWeek: number; period: number;
  className: string; subjectName: string; reason: string;
  suggestions: { id: string; full_name: string; code: string }[];
}

export default function BusySchedulePage() {
  const [tab, setTab] = useState<'pending' | 'done' | 'conflicts'>('pending');
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [requests, setRequests] = useState<BusyRequest[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; note: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const token = () => localStorage.getItem('token') ?? '';

  useEffect(() => {
    fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(data => {
        setYears(data);
        const first = data[0]?.semesters?.[0]?.id;
        if (first) setSelectedSemesterId(first);
      });
  }, []);

  const fetchRequests = useCallback(async (status?: string) => {
    if (!selectedSemesterId) return;
    setLoading(true);
    const url = `${API_URL}/busy-schedule?semesterId=${selectedSemesterId}${status ? `&status=${status}` : ''}`;
    const data = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json());
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [selectedSemesterId]);

  const fetchConflicts = useCallback(async () => {
    if (!selectedSemesterId) return;
    setLoading(true);
    const data = await fetch(`${API_URL}/busy-schedule/conflicts/${selectedSemesterId}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json());
    setConflicts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [selectedSemesterId]);

  useEffect(() => {
    if (!selectedSemesterId) return;
    if (tab === 'pending') fetchRequests('PENDING');
    else if (tab === 'done') fetchRequests();
    else fetchConflicts();
  }, [tab, selectedSemesterId, fetchRequests, fetchConflicts]);

  const approve = async (id: string) => {
    await fetch(`${API_URL}/busy-schedule/${id}/approve`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}` } });
    showToast('Đã duyệt');
    fetchRequests('PENDING');
  };

  const reject = async () => {
    if (!rejectDialog) return;
    await fetch(`${API_URL}/busy-schedule/${rejectDialog.id}/reject`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ note: rejectDialog.note }),
    });
    setRejectDialog(null);
    showToast('Đã từ chối');
    fetchRequests('PENDING');
  };

  const resolve = async (timetableSlotId: string, substituteTeacherId: string, conflictKey: string) => {
    setResolving(conflictKey);
    await fetch(`${API_URL}/busy-schedule/conflicts/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ timetableSlotId, substituteTeacherId }),
    });
    setResolving(null);
    showToast('Đã cập nhật GV thay thế');
    fetchConflicts();
  };

  const pendingCount = tab === 'pending' ? requests.length : 0;

  return (
    <div className="space-y-6 pb-10">
      {toast && (
        <div className={`fixed right-6 top-20 z-50 rounded-lg border-l-4 px-5 py-3 shadow-lg font-semibold text-sm
          ${toast.ok ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lịch bận giáo viên</h1>
        <select
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-sm font-medium text-[var(--text-primary)]"
          value={selectedSemesterId}
          onChange={e => setSelectedSemesterId(e.target.value)}
        >
          {years.map(y => y.semesters.map(s => (
            <option key={s.id} value={s.id}>{y.name} — {s.name}</option>
          )))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {([
          { key: 'pending', label: 'Chờ duyệt' },
          { key: 'done', label: 'Đã xử lý' },
          { key: 'conflicts', label: 'Xung đột TKB' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
            {t.key === 'conflicts' && conflicts.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{conflicts.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Đang tải...</div>
      ) : (
        <>
          {/* ── PENDING & DONE ── */}
          {(tab === 'pending' || tab === 'done') && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              {requests.length === 0 ? (
                <div className="py-16 text-center text-[var(--text-muted)]">Không có yêu cầu nào</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--bg-surface-hover)] text-xs font-bold text-[var(--text-secondary)] uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Giáo viên</th>
                      <th className="px-4 py-3 text-center">Tuần</th>
                      <th className="px-4 py-3 text-center">Thứ</th>
                      <th className="px-4 py-3 text-center">Tiết</th>
                      <th className="px-4 py-3 text-left">Lý do</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                      {tab === 'pending' && <th className="px-4 py-3 text-center">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {requests.filter(r => tab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING').map(r => (
                      <tr key={r.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                          {r.teacher.full_name}
                          <span className="ml-1 text-xs text-[var(--text-muted)]">({r.teacher.code})</span>
                        </td>
                        <td className="px-4 py-3 text-center">{r.week_number}</td>
                        <td className="px-4 py-3 text-center">{DAY_LABELS[r.day_of_week]}</td>
                        <td className="px-4 py-3 text-center font-mono">{r.period}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate">{r.reason}</td>
                        <td className="px-4 py-3 text-center">
                          {r.status === 'PENDING' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Chờ duyệt</span>}
                          {r.status === 'APPROVED' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đã duyệt</span>}
                          {r.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700" title={r.rejection_note}>
                              Từ chối
                            </span>
                          )}
                        </td>
                        {tab === 'pending' && (
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => approve(r.id)}
                                className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">
                                ✓ Duyệt
                              </button>
                              <button onClick={() => setRejectDialog({ id: r.id, note: '' })}
                                className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700">
                                ✗ Từ chối
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── CONFLICTS ── */}
          {tab === 'conflicts' && (
            <div className="space-y-4">
              {conflicts.length === 0 ? (
                <div className="rounded-xl border border-green-200 bg-green-50 py-16 text-center text-green-700 font-semibold">
                  ✅ Không có xung đột nào giữa lịch bận và thời khóa biểu
                </div>
              ) : conflicts.map((c, i) => (
                <div key={i} className="rounded-xl border border-red-200 bg-[var(--bg-surface)] p-5 space-y-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-lg">⚠️</span>
                        <span className="font-bold text-[var(--text-primary)]">{c.teacher.full_name}</span>
                        <span className="text-xs text-[var(--text-muted)]">({c.teacher.code})</span>
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        Bận <strong>Tuần {c.weekNumber}</strong> — {DAY_LABELS[c.dayOfWeek]} Tiết {c.period}
                        {' '}→ Đang dạy <strong>{c.subjectName}</strong> lớp <strong>{c.className}</strong>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">Lý do: {c.reason}</div>
                    </div>
                  </div>

                  {c.suggestions.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold text-[var(--text-secondary)] mb-2">Gợi ý GV thay thế:</div>
                      <div className="flex flex-wrap gap-2">
                        {c.suggestions.map(s => {
                          const key = `${c.timetableSlotId}-${s.id}`;
                          return (
                            <button key={s.id}
                              onClick={() => resolve(c.timetableSlotId, s.id, key)}
                              disabled={resolving === key}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-sm font-semibold text-blue-700 disabled:opacity-50 transition-colors">
                              {resolving === key ? '...' : `✓ ${s.full_name} (${s.code})`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-red-500 font-semibold">
                      ❌ Không tìm được GV thay thế phù hợp — cần xử lý thủ công
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Từ chối yêu cầu</h3>
            <textarea
              className="w-full rounded-lg border border-[var(--border-default)] p-3 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] h-24 resize-none"
              placeholder="Lý do từ chối (sẽ gửi đến giáo viên)..."
              value={rejectDialog.note}
              onChange={e => setRejectDialog({ ...rejectDialog, note: e.target.value })}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectDialog(null)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] font-medium text-sm">
                Hủy
              </button>
              <button onClick={reject}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700">
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
