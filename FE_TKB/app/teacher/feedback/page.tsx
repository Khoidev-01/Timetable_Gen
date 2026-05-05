'use client';
import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

const DAY_LABELS: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7' };
const DAYS = [2, 3, 4, 5, 6, 7];
const MORNING_PERIODS = [1, 2, 3, 4, 5];
const AFTERNOON_PERIODS = [6, 7, 8, 9, 10];

interface SchoolYear { id: string; name: string; semesters: { id: string; name: string; start_date?: string; end_date?: string }[] }
interface BusyRequest { id: string; week_number: number; day_of_week: number; period: number; reason: string; status: string; rejection_note?: string }

export default function TeacherFeedbackPage() {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(20);
  const [selectedSlots, setSelectedSlots] = useState<{ dayOfWeek: number; period: number }[]>([]);
  const [reason, setReason] = useState('');
  const [myRequests, setMyRequests] = useState<BusyRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const token = () => localStorage.getItem('token') ?? '';

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(data => {
        setYears(data);
        const first = data[0]?.semesters?.[0]?.id;
        if (first) setSelectedSemesterId(first);
      });
  }, []);

  // Compute totalWeeks from semester dates
  useEffect(() => {
    if (!selectedSemesterId || !years.length) return;
    for (const y of years) {
      for (const s of y.semesters) {
        if (s.id === selectedSemesterId) {
          if (s.start_date && s.end_date) {
            const weeks = Math.ceil((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / (7 * 24 * 3600 * 1000));
            setTotalWeeks(Math.max(1, weeks));
          }
          break;
        }
      }
    }
    setSelectedWeek(1);
    setSelectedSlots([]);
  }, [selectedSemesterId, years]);

  const fetchMyRequests = useCallback(async () => {
    if (!selectedSemesterId) return;
    const data = await fetch(`${API_URL}/busy-schedule/my?semesterId=${selectedSemesterId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json());
    setMyRequests(Array.isArray(data) ? data : []);
  }, [selectedSemesterId]);

  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  const isSelected = (day: number, period: number) =>
    selectedSlots.some(s => s.dayOfWeek === day && s.period === period);

  const isSubmitted = (day: number, period: number) =>
    myRequests.some(r => r.week_number === selectedWeek && r.day_of_week === day && r.period === period);

  const toggleSlot = (day: number, period: number) => {
    if (isSubmitted(day, period)) return;
    setSelectedSlots(prev =>
      prev.some(s => s.dayOfWeek === day && s.period === period)
        ? prev.filter(s => !(s.dayOfWeek === day && s.period === period))
        : [...prev, { dayOfWeek: day, period }]
    );
  };

  const handleSubmit = async () => {
    if (!selectedSlots.length) { showToast('Chưa chọn tiết nào', false); return; }
    if (!reason.trim()) { showToast('Vui lòng nhập lý do', false); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/busy-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          semesterId: selectedSemesterId,
          slots: selectedSlots.map(s => ({ weekNumber: selectedWeek, dayOfWeek: s.dayOfWeek, period: s.period })),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Đã gửi ${data.count} yêu cầu`);
        setSelectedSlots([]);
        setReason('');
        fetchMyRequests();
      } else {
        showToast(data.message || 'Lỗi gửi yêu cầu', false);
      }
    } catch { showToast('Lỗi kết nối', false); }
    setSubmitting(false);
  };

  const cancelRequest = async (id: string) => {
    await fetch(`${API_URL}/busy-schedule/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    showToast('Đã hủy yêu cầu');
    fetchMyRequests();
  };

  const weekRequests = myRequests.filter(r => r.week_number === selectedWeek);

  const renderCell = (day: number, period: number) => {
    const submitted = isSubmitted(day, period);
    const selected = isSelected(day, period);
    return (
      <td key={day}
        onClick={() => toggleSlot(day, period)}
        className={`h-12 text-center transition-colors border-r border-[var(--border-default)] last:border-r-0
          ${submitted ? 'bg-orange-100 cursor-not-allowed' : selected ? 'bg-red-100 hover:bg-red-200 cursor-pointer' : 'hover:bg-[var(--bg-surface-hover)] cursor-pointer'}`}
      >
        {submitted && <span className="text-[10px] font-bold text-orange-600">Đã gửi</span>}
        {selected && !submitted && <span className="text-[10px] font-bold text-red-600">BẬN</span>}
      </td>
    );
  };

  return (
    <div className="space-y-5 pb-10 max-w-5xl">
      {toast && (
        <div className={`fixed right-6 top-20 z-50 rounded-lg border-l-4 px-5 py-3 shadow-lg font-semibold text-sm
          ${toast.ok ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đăng ký lịch bận</h1>
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

      {/* Week Picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Tuần:</span>
        <button onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
          className="w-8 h-8 rounded-lg bg-[var(--bg-surface-hover)] font-bold text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-colors">‹</button>
        <span className="min-w-[70px] text-center font-bold text-[var(--text-primary)]">Tuần {selectedWeek}</span>
        <button onClick={() => setSelectedWeek(w => Math.min(totalWeeks, w + 1))}
          className="w-8 h-8 rounded-lg bg-[var(--bg-surface-hover)] font-bold text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-colors">›</button>
        <span className="text-xs text-[var(--text-muted)]">/ {totalWeeks} tuần</span>
        {selectedSlots.length > 0 && (
          <span className="ml-2 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {selectedSlots.length} tiết chọn
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm select-none">
            <thead className="bg-[var(--bg-surface-hover)] text-xs font-bold text-[var(--text-secondary)] uppercase">
              <tr>
                <th className="px-3 py-2 border-r border-b border-[var(--border-default)] w-16 text-center">Buổi</th>
                <th className="px-3 py-2 border-r border-b border-[var(--border-default)] w-10 text-center">Tiết</th>
                {DAYS.map(d => (
                  <th key={d} className="px-4 py-2 border-r border-b border-[var(--border-default)] last:border-r-0 text-center">{DAY_LABELS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MORNING_PERIODS.map((p, i) => (
                <tr key={`m-${p}`} className="divide-x divide-[var(--border-default)] border-b border-[var(--border-default)]">
                  {i === 0 && (
                    <td rowSpan={5} className="px-2 text-center text-xs font-bold bg-blue-50 text-blue-700 border-r border-[var(--border-default)] align-middle w-16">
                      SÁNG
                    </td>
                  )}
                  <td className="px-3 py-2 text-center font-mono text-xs text-[var(--text-muted)] bg-[var(--bg-surface-hover)] border-r border-[var(--border-default)] w-10">{p}</td>
                  {DAYS.map(d => renderCell(d, p))}
                </tr>
              ))}
              {AFTERNOON_PERIODS.map((p, i) => (
                <tr key={`c-${p}`} className={`divide-x divide-[var(--border-default)] ${i < 4 ? 'border-b border-[var(--border-default)]' : ''}`}>
                  {i === 0 && (
                    <td rowSpan={5} className="px-2 text-center text-xs font-bold bg-orange-50 text-orange-700 border-r border-t-2 border-[var(--border-default)] align-middle w-16">
                      CHIỀU
                    </td>
                  )}
                  <td className={`px-3 py-2 text-center font-mono text-xs text-[var(--text-muted)] bg-[var(--bg-surface-hover)] border-r border-[var(--border-default)] w-10 ${i === 0 ? 'border-t-2' : ''}`}>{p}</td>
                  {DAYS.map(d => renderCell(d, p))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason + Submit */}
      <div className="flex gap-3 items-start">
        <textarea
          className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] resize-none h-16"
          placeholder="Lý do bận (bắt buộc)..."
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedSlots.length || !reason.trim()}
          className="px-5 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {submitting ? 'Đang gửi...' : `Gửi (${selectedSlots.length} tiết)`}
        </button>
      </div>

      {/* Requests for current week */}
      {weekRequests.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-default)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Yêu cầu đã gửi — Tuần {selectedWeek}</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-surface-hover)] text-xs font-bold text-[var(--text-secondary)] uppercase">
              <tr>
                <th className="px-4 py-2 text-center">Thứ</th>
                <th className="px-4 py-2 text-center">Tiết</th>
                <th className="px-4 py-2 text-left">Lý do</th>
                <th className="px-4 py-2 text-center">Trạng thái</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {weekRequests.map(r => (
                <tr key={r.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <td className="px-4 py-2.5 text-center">{DAY_LABELS[r.day_of_week]}</td>
                  <td className="px-4 py-2.5 text-center font-mono">{r.period}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.status === 'PENDING' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Chờ duyệt</span>}
                    {r.status === 'APPROVED' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đã duyệt</span>}
                    {r.status === 'REJECTED' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700" title={r.rejection_note}>Từ chối</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.status === 'PENDING' && (
                      <button onClick={() => cancelRequest(r.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                        Hủy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] italic">
        * Đăng ký bận quá nhiều có thể ảnh hưởng đến khả năng xếp được thời khóa biểu. Vui lòng cân nhắc.
      </p>
    </div>
  );
}
