'use client';
import { useState, useEffect, useCallback } from 'react';
import TimetableGrid from '@/app/components/admin/TimetableGrid';
import { API_URL } from '@/lib/api';

export default function TeacherSchedulePage() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<{ id: string; name: string; yearName: string; start_date?: string }[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [semesterStartDate, setSemesterStartDate] = useState<string | null>(null);
  const [myTeacherId, setMyTeacherId] = useState('');
  const [loading, setLoading] = useState(false);

  const token = () => localStorage.getItem('token') ?? '';

  // Resolve own teacher profile ID
  useEffect(() => {
    fetch(`${API_URL}/auth/profile`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(data => {
        if (data.teacherId) setMyTeacherId(data.teacherId);
        else if (data.teacher_profile?.id) setMyTeacherId(data.teacher_profile.id);
      }).catch(() => {});
  }, []);

  // Load semesters
  useEffect(() => {
    fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then((years: any[]) => {
        const sems: any[] = [];
        years.forEach(y => y.semesters?.forEach((s: any) => sems.push({ ...s, yearName: y.name })));
        setSemesters(sems);
        if (sems.length) setSelectedSemesterId(sems[0].id);
      }).catch(() => {});
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!selectedSemesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/algorithm/result/${selectedSemesterId}?week=${selectedWeek}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.bestSchedule ?? []);
        setTotalWeeks(data.totalWeeks ?? 1);
        setSemesterStartDate(data.semesterStartDate ?? null);
      } else {
        setSchedule([]);
      }
    } catch { setSchedule([]); }
    setLoading(false);
  }, [selectedSemesterId, selectedWeek]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  // Reset week when semester changes
  useEffect(() => { setSelectedWeek(1); }, [selectedSemesterId]);

  const getWeekDateRange = () => {
    if (!semesterStartDate) return null;
    const start = new Date(semesterStartDate);
    start.setDate(start.getDate() + (selectedWeek - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const mySlots = schedule.filter(s => s.teacherId === myTeacherId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-default)]">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mr-2">Thời khóa biểu của tôi</h1>

        <select
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)]"
          value={selectedSemesterId}
          onChange={e => setSelectedSemesterId(e.target.value)}
        >
          {semesters.map(s => <option key={s.id} value={s.id}>{s.yearName} — {s.name}</option>)}
        </select>

        {/* Week Picker */}
        <div className="flex items-center gap-2 border-l border-[var(--border-default)] pl-3 ml-1">
          <button onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
            className="w-7 h-7 rounded bg-[var(--bg-surface-hover)] font-bold text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-colors text-sm">‹</button>
          <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[80px] text-center">
            Tuần {selectedWeek}
            {getWeekDateRange() && <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({getWeekDateRange()})</span>}
          </span>
          <button onClick={() => setSelectedWeek(w => Math.min(totalWeeks, w + 1))}
            className="w-7 h-7 rounded bg-[var(--bg-surface-hover)] font-bold text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-colors text-sm">›</button>
          <span className="text-xs text-[var(--text-muted)]">/ {totalWeeks}</span>
        </div>

        {loading && <span className="text-xs text-[var(--text-muted)] ml-auto animate-pulse">Đang tải...</span>}
      </div>

      {/* Grid */}
      <div className="flex-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-[var(--bg-surface)]/60 z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        )}

        {!loading && mySlots.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
            {schedule.length === 0 ? 'Chưa có thời khóa biểu' : 'Tuần này không có tiết dạy'}
          </div>
        ) : (
          <TimetableGrid
            schedule={schedule}
            isEditable={false}
            viewMode="TEACHER"
            selectedEntityId={myTeacherId}
          />
        )}
      </div>
    </div>
  );
}
